/*
 * ContaminationHunter — Arduino Demo Firmware
 * Board: Arduino UNO R3
 *
 * Pin Map:
 *   2  → DHT11 signal
 *   3  → MAX7219 DIN
 *   4  → MAX7219 CS
 *   5  → MAX7219 CLK
 *   6  → Zone 1 LED (green)
 *   7  → Zone 2 LED (green)
 *   8  → Zone 3 LED (yellow)
 *   9  → Zone 4 LED (red)
 *  10  → Active buzzer
 *  11  → Fan/motor (transistor base, NPN PN2222)
 *  12  → Button 1 (manual contamination trigger)
 *  13  → Button 2 (fan on/off toggle / demo reset)
 */

#include <DHT.h>
#include <LedControl.h>

// ── Pin definitions ──────────────────────────────────────────────────────────
#define DHT_PIN       2
#define MAX_DIN       3
#define MAX_CS        4
#define MAX_CLK       5
#define LED_ZONE1     6
#define LED_ZONE2     7
#define LED_ZONE3     8
#define LED_ZONE4     9
#define BUZZER_PIN   10
#define FAN_PIN      11
#define BTN1_PIN     12
#define BTN2_PIN     13

// ── DHT11 ────────────────────────────────────────────────────────────────────
#define DHT_TYPE DHT11
DHT dht(DHT_PIN, DHT_TYPE);

// ── MAX7219 ──────────────────────────────────────────────────────────────────
LedControl lc = LedControl(MAX_DIN, MAX_CLK, MAX_CS, 1);

// ── State machine ─────────────────────────────────────────────────────────────
enum State { IDLE, CONTAMINATED, SOLVED };
State state = IDLE;

// ── Startup lockout ───────────────────────────────────────────────────────────
// DHT11 produces garbage readings for the first few seconds after power-on.
// We discard the first WARMUP_READS readings entirely, then build a baseline,
// then arm detection. No contamination can trigger during this window.
const int  WARMUP_READS       = 5;    // discard first N reads (5 seconds)
const int  BASELINE_SAMPLES   = 8;    // then average N reads for baseline (~8s)
int        warmupCount        = 0;
bool       warmupDone         = false;

// ── DHT11 baseline ────────────────────────────────────────────────────────────
float baselineHumidity    = 0;
float baselineTemp        = 0;
bool  baselineReady       = false;
int   baselineSampleCount = 0;
float humidityAccum       = 0;
float tempAccum           = 0;

// ── Spike confirmation ────────────────────────────────────────────────────────
// Require SPIKE_CONFIRM consecutive readings above threshold before triggering.
// This prevents a single noisy reading from firing contamination.
const int SPIKE_CONFIRM   = 3;
int       spikeCount      = 0;

// ── Detection thresholds (tune these after testing) ───────────────────────────
const float HUMIDITY_DELTA = 12.0;  // % above baseline to count as a spike
const float TEMP_DELTA     = 1.5;   // °C drop below baseline (contributing factor)

// ── Timing ───────────────────────────────────────────────────────────────────
unsigned long lastDHTRead        = 0;
const long    DHT_INTERVAL       = 1000;

unsigned long lastHeartbeat      = 0;
const long    HEARTBEAT_INTERVAL = 5000;

// ── Buzzer pulsing ────────────────────────────────────────────────────────────
bool          buzzerOn         = false;
unsigned long lastBuzzerToggle = 0;
const long    BUZZER_ON_MS     = 300;
const long    BUZZER_OFF_MS    = 400;

// ── Zone 4 LED pulsing ───────────────────────────────────────────────────────
bool          zone4LedOn     = false;
unsigned long lastZone4Toggle = 0;
const long    ZONE4_PULSE_MS  = 500;

// ── Button debounce ──────────────────────────────────────────────────────────
unsigned long lastBtn1Press = 0;
unsigned long lastBtn2Press = 0;
const long    DEBOUNCE_MS   = 1000;

// ── MAX7219 bar display ───────────────────────────────────────────────────────
int           contaminationLevel = 0;
unsigned long lastDisplayUpdate  = 0;
const long    DISPLAY_INTERVAL   = 200;

// ── Serial input buffer ──────────────────────────────────────────────────────
String serialBuffer = "";

// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(9600);

  dht.begin();

  lc.shutdown(0, false);
  lc.setIntensity(0, 8);
  lc.clearDisplay(0);

  pinMode(LED_ZONE1, OUTPUT);
  pinMode(LED_ZONE2, OUTPUT);
  pinMode(LED_ZONE3, OUTPUT);
  pinMode(LED_ZONE4, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(BTN1_PIN, INPUT_PULLUP);
  pinMode(BTN2_PIN, INPUT_PULLUP);

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(FAN_PIN, HIGH);   // fan on at startup

  // ── LED startup test — flash all LEDs for 1 second so you can verify wiring
  setAllLeds(HIGH);
  delay(1000);
  setAllLeds(LOW);

  Serial.println("ARDUINO_READY");
  Serial.println("STATUS: Warming up DHT11 sensor...");
}

// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // Serial commands from backend
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      serialBuffer.trim();
      handleSerialCommand(serialBuffer);
      serialBuffer = "";
    } else {
      serialBuffer += c;
    }
  }

  // DHT11 read (1Hz max)
  if (now - lastDHTRead >= DHT_INTERVAL) {
    lastDHTRead = now;
    readDHT();
  }

  // Button 1 — manual contamination trigger
  // Only allowed after baseline is fully armed — not during warmup or baseline phase
  if (digitalRead(BTN1_PIN) == LOW && state == IDLE && baselineReady &&
      now - lastBtn1Press > DEBOUNCE_MS) {
    lastBtn1Press = now;
    Serial.println("STATUS: Button 1 pressed — manual trigger");
    triggerContamination();
  }

  // Button 2 — fan toggle / demo reset
  if (digitalRead(BTN2_PIN) == LOW && now - lastBtn2Press > DEBOUNCE_MS) {
    lastBtn2Press = now;
    handleBtn2();
  }

  // Buzzer pulse (CONTAMINATED only)
  if (state == CONTAMINATED) {
    long buzzerPeriod = buzzerOn ? BUZZER_ON_MS : BUZZER_OFF_MS;
    if (now - lastBuzzerToggle >= (unsigned long)buzzerPeriod) {
      lastBuzzerToggle = now;
      buzzerOn = !buzzerOn;
      digitalWrite(BUZZER_PIN, buzzerOn ? HIGH : LOW);
    }

    // Zone 4 red LED pulse
    if (now - lastZone4Toggle >= ZONE4_PULSE_MS) {
      lastZone4Toggle = now;
      zone4LedOn = !zone4LedOn;
      digitalWrite(LED_ZONE4, zone4LedOn ? HIGH : LOW);
    }
  }

  // MAX7219 update
  if (now - lastDisplayUpdate >= DISPLAY_INTERVAL) {
    lastDisplayUpdate = now;
    updateDisplay();
  }

  // Heartbeat
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    lastHeartbeat = now;
    Serial.println("HEARTBEAT");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DHT11 reading — warmup → baseline → detection
// ─────────────────────────────────────────────────────────────────────────────
void readDHT() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  // Reject NaN reads
  if (isnan(h) || isnan(t)) {
    Serial.println("STATUS: DHT read failed, retrying...");
    return;
  }

  // Phase 1: warmup — discard first WARMUP_READS readings silently
  if (!warmupDone) {
    warmupCount++;
    Serial.print("STATUS: Warmup ");
    Serial.print(warmupCount);
    Serial.print("/");
    Serial.print(WARMUP_READS);
    Serial.print(" H=");
    Serial.print(h);
    Serial.print(" T=");
    Serial.println(t);
    if (warmupCount >= WARMUP_READS) {
      warmupDone = true;
      Serial.println("STATUS: Warmup complete. Building baseline...");
    }
    return;
  }

  // Phase 2: baseline — average BASELINE_SAMPLES readings
  if (!baselineReady) {
    humidityAccum += h;
    tempAccum     += t;
    baselineSampleCount++;
    Serial.print("STATUS: Baseline ");
    Serial.print(baselineSampleCount);
    Serial.print("/");
    Serial.print(BASELINE_SAMPLES);
    Serial.print(" H=");
    Serial.print(h);
    Serial.print(" T=");
    Serial.println(t);
    if (baselineSampleCount >= BASELINE_SAMPLES) {
      baselineHumidity = humidityAccum / BASELINE_SAMPLES;
      baselineTemp     = tempAccum     / BASELINE_SAMPLES;
      baselineReady    = true;
      Serial.print("STATUS: Baseline set. H=");
      Serial.print(baselineHumidity);
      Serial.print(" T=");
      Serial.println(baselineTemp);
      Serial.println("STATUS: Detection armed.");
    }
    return;
  }

  // Phase 3: active monitoring
  float humidityDelta = h - baselineHumidity;
  float tempDelta     = baselineTemp - t;  // positive = temp dropped

  // Print live readings to serial so you can watch the values
  Serial.print("READING H=");
  Serial.print(h);
  Serial.print(" dH=");
  Serial.print(humidityDelta);
  Serial.print(" T=");
  Serial.print(t);
  Serial.print(" dT=");
  Serial.println(tempDelta);

  // Update bar display level (always reactive to environment)
  float normalized = constrain(humidityDelta / HUMIDITY_DELTA, 0.0, 1.0);
  int rawLevel = (int)(normalized * 8.0);

  if (state == CONTAMINATED || state == SOLVED) {
    contaminationLevel = max(rawLevel, 5);  // min 5 bars when contaminated
  } else {
    contaminationLevel = rawLevel;
    updateIdleLeds(contaminationLevel);
  }

  // Spike detection — only in IDLE, only when detection is armed
  if (state == IDLE) {
    bool humiditySpike = humidityDelta >= HUMIDITY_DELTA;
    bool tempContrib   = tempDelta >= TEMP_DELTA;

    if (humiditySpike || (humidityDelta >= HUMIDITY_DELTA * 0.7 && tempContrib)) {
      spikeCount++;
      Serial.print("STATUS: Spike detected (");
      Serial.print(spikeCount);
      Serial.print("/");
      Serial.print(SPIKE_CONFIRM);
      Serial.println(")");
      if (spikeCount >= SPIKE_CONFIRM) {
        triggerContamination();
      }
    } else {
      // Reset spike counter if reading drops back down
      spikeCount = 0;
    }

    // Adaptive baseline drift — slowly follows ambient in IDLE
    baselineHumidity = baselineHumidity * 0.97 + h * 0.03;
    baselineTemp     = baselineTemp     * 0.97 + t * 0.03;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reactive LED update during IDLE
// ─────────────────────────────────────────────────────────────────────────────
void updateIdleLeds(int level) {
  digitalWrite(LED_ZONE1, level >= 2 ? HIGH : LOW);
  digitalWrite(LED_ZONE2, level >= 4 ? HIGH : LOW);
  digitalWrite(LED_ZONE3, level >= 6 ? HIGH : LOW);
  digitalWrite(LED_ZONE4, LOW);
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger contamination — IDLE → CONTAMINATED
// ─────────────────────────────────────────────────────────────────────────────
void triggerContamination() {
  if (state != IDLE) return;
  state = CONTAMINATED;
  spikeCount = 0;

  setAllLeds(HIGH);

  buzzerOn = true;
  digitalWrite(BUZZER_PIN, HIGH);
  lastBuzzerToggle = millis();

  zone4LedOn = true;
  lastZone4Toggle = millis();

  contaminationLevel = 8;

  Serial.println("CONTAMINATION_DETECTED");
}

// ─────────────────────────────────────────────────────────────────────────────
// Button 2 handler
// ─────────────────────────────────────────────────────────────────────────────
void handleBtn2() {
  if (state == CONTAMINATED) {
    stopFan();
  } else if (state == SOLVED) {
    resetDemo();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop fan — CONTAMINATED → SOLVED
// ─────────────────────────────────────────────────────────────────────────────
void stopFan() {
  if (state != CONTAMINATED) return;
  state = SOLVED;

  digitalWrite(FAN_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  buzzerOn = false;

  setAllLeds(HIGH);
  digitalWrite(LED_ZONE4, HIGH);  // solid, not pulsing

  Serial.println("FAN_STOPPED");
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset demo — SOLVED → IDLE
// ─────────────────────────────────────────────────────────────────────────────
void resetDemo() {
  state = IDLE;

  digitalWrite(FAN_PIN, HIGH);
  setAllLeds(LOW);
  digitalWrite(BUZZER_PIN, LOW);
  buzzerOn = false;

  contaminationLevel = 0;
  updateDisplay();  // explicitly clear by drawing 0 level

  // Re-arm from scratch
  warmupDone          = false;
  warmupCount         = 0;
  baselineReady       = false;
  baselineSampleCount = 0;
  humidityAccum       = 0;
  tempAccum           = 0;
  spikeCount          = 0;

  Serial.println("DEMO_RESET");
  Serial.println("STATUS: Warming up DHT11 sensor...");
}

// ─────────────────────────────────────────────────────────────────────────────
// Handle serial commands from backend
// ─────────────────────────────────────────────────────────────────────────────
void handleSerialCommand(String cmd) {
  if (cmd == "STOP_FAN") {
    stopFan();
  } else if (cmd == "START_FAN") {
    resetDemo();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update MAX7219 bar display
// Uses setRow() — fills rows bottom to top based on contaminationLevel (0-8).
// Row 7 = bottom row, Row 0 = top row.
// Each active row is fully lit (all 8 LEDs = 0xFF).
// ─────────────────────────────────────────────────────────────────────────────
void updateDisplay() {
  for (int row = 0; row < 8; row++) {
    // Row 7 is the bottom. Fill from bottom up.
    // A row is lit if it falls within the contamination level.
    // level 0 = all off, level 8 = all on.
    int threshold = 8 - contaminationLevel;  // rows 0..(threshold-1) are off
    if (row >= threshold) {
      lc.setRow(0, row, 0xFF);  // all 8 LEDs in this row ON
    } else {
      lc.setRow(0, row, 0x00);  // all 8 LEDs in this row OFF
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: set all zone LEDs
// ─────────────────────────────────────────────────────────────────────────────
void setAllLeds(int val) {
  digitalWrite(LED_ZONE1, val);
  digitalWrite(LED_ZONE2, val);
  digitalWrite(LED_ZONE3, val);
  digitalWrite(LED_ZONE4, val);
}
