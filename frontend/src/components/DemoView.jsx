import React, { useState, useEffect, useRef, useCallback } from 'react';
import AgentFeed from './AgentFeed.jsx';
import DiagnosisCard from './DiagnosisCard.jsx';
import FabMap from './FabMap.jsx';

// ── WebSocket connection to serial bridge ─────────────────────────────────────
const WS_URL = 'ws://localhost:3003';

// ── Mock Scenario A readings (HVAC Unit #7 contamination) ────────────────────
const BASELINE_READINGS = {
  'lithography-bay':  { particles: 0.07, trend: 'stable', particleSize: '0.3µm' },
  'etch-chamber':     { particles: 0.09, trend: 'stable', particleSize: '0.3µm' },
  'deposition':       { particles: 0.08, trend: 'stable', particleSize: '0.3µm' },
  'cmp':              { particles: 0.06, trend: 'stable', particleSize: '0.3µm' },
  'metrology':        { particles: 0.08, trend: 'stable', particleSize: '0.3µm' },
  'clean-station':    { particles: 0.09, trend: 'stable', particleSize: '0.3µm' },
  'hvac-unit-7':      { particles: 0.07, trend: 'stable', particleSize: '0.3µm' },
  'chemical-storage': { particles: 0.06, trend: 'stable', particleSize: '0.3µm' },
};

// ── Demo states ───────────────────────────────────────────────────────────────
// IDLE          → waiting for contamination signal
// INVESTIGATING → mock agent pipeline running
// COMPLETE      → investigation done, "Solve Problem" button shown
// SOLVING       → waiting for Arduino to confirm fan stopped
// SOLVED        → fan confirmed stopped, success state
const DEMO_STATES = {
  IDLE:          'IDLE',
  INVESTIGATING: 'INVESTIGATING',
  COMPLETE:      'COMPLETE',
  SOLVING:       'SOLVING',
  SOLVED:        'SOLVED',
};

// ── Arduino status badge ──────────────────────────────────────────────────────
function ArduinoStatus({ connected }) {
  return (
    <div className="demo-arduino-status">
      <span
        className="demo-arduino-dot"
        style={{ background: connected ? '#22c55e' : '#475569' }}
      />
      <span style={{ color: connected ? '#22c55e' : '#475569' }}>
        {connected ? 'Arduino connected' : 'Arduino not detected — manual mode'}
      </span>
    </div>
  );
}

// ── Zone LED status strip (mirrors the physical LEDs) ─────────────────────────
function LedStrip({ demoState }) {
  const contaminated = demoState === DEMO_STATES.INVESTIGATING ||
                       demoState === DEMO_STATES.COMPLETE ||
                       demoState === DEMO_STATES.SOLVING;
  const solved       = demoState === DEMO_STATES.SOLVED;

  return (
    <div className="demo-led-strip">
      <span className="demo-led-label">PHYSICAL ZONE LEDS</span>
      <div className="demo-leds">
        {[
          { zone: 'Zone 1', color: '#22c55e', on: contaminated || solved },
          { zone: 'Zone 2', color: '#22c55e', on: contaminated || solved },
          { zone: 'Zone 3', color: '#eab308', on: contaminated || solved },
          { zone: 'Zone 4', color: '#ef4444', on: contaminated || solved, pulse: demoState === DEMO_STATES.INVESTIGATING || demoState === DEMO_STATES.COMPLETE },
        ].map(led => (
          <div key={led.zone} className="demo-led-item">
            <div
              className={`demo-led-dot ${led.pulse ? 'demo-led-pulse' : ''}`}
              style={{
                background: led.on ? led.color : '#1e2d4a',
                boxShadow: led.on ? `0 0 10px ${led.color}88` : 'none',
              }}
            />
            <span className="demo-led-zone">{led.zone}</span>
          </div>
        ))}
      </div>
      <div className="demo-led-legend">
        <span><span className="demo-led-swatch" style={{ background: '#22c55e' }} />Normal</span>
        <span><span className="demo-led-swatch" style={{ background: '#eab308' }} />Elevated</span>
        <span><span className="demo-led-swatch" style={{ background: '#ef4444' }} />Critical</span>
      </div>
    </div>
  );
}

// ── Idle waiting screen ───────────────────────────────────────────────────────
function IdleScreen({ arduinoConnected, onManualTrigger }) {
  return (
    <div className="demo-idle">
      <div className="demo-idle-icon">🌬️</div>
      <div className="demo-idle-title">Awaiting Contamination Event</div>
      <div className="demo-idle-sub">
        Blow on the DHT11 environment sensor to trigger the HVAC contamination event,<br />
        or press Button 1 on the Arduino to trigger manually.
      </div>
      <div className="demo-idle-indicators">
        <div className="demo-idle-indicator">
          <span className="demo-idle-indicator-dot" style={{ background: '#22c55e' }} />
          <span>HVAC Unit #7 — Operational</span>
        </div>
        <div className="demo-idle-indicator">
          <span className="demo-idle-indicator-dot" style={{ background: '#22c55e' }} />
          <span>Fan running — normal speed</span>
        </div>
        <div className="demo-idle-indicator">
          <span className="demo-idle-indicator-dot blink" style={{ background: '#0ea5e9' }} />
          <span>Environment sensor — monitoring</span>
        </div>
      </div>
      {!arduinoConnected && (
        <button className="demo-manual-trigger-btn" onClick={onManualTrigger}>
          ▶ Simulate Contamination (no Arduino)
        </button>
      )}
    </div>
  );
}

// ── Solve Problem button ──────────────────────────────────────────────────────
function SolveProblemButton({ onSolve, solving }) {
  return (
    <div className="demo-solve-wrap">
      <div className="demo-solve-label">
        ⚠ HVAC Unit #7 identified as contamination source. Shutdown recommended.
      </div>
      <button
        className={`demo-solve-btn ${solving ? 'demo-solve-btn-solving' : ''}`}
        onClick={onSolve}
        disabled={solving}
      >
        {solving ? (
          <>
            <span className="spin" style={{ display: 'inline-block', marginRight: 8 }}>⟳</span>
            Sending shutdown signal to HVAC Unit #7...
          </>
        ) : (
          <>🔴 Solve Problem — Shut Down HVAC Unit #7</>
        )}
      </button>
      <div className="demo-solve-sub">
        This will send a signal to the physical Arduino model to stop the fan motor.
      </div>
    </div>
  );
}

// ── Solved success banner ─────────────────────────────────────────────────────
function SolvedBanner() {
  return (
    <div className="demo-solved-banner">
      <div className="demo-solved-icon">✓</div>
      <div>
        <div className="demo-solved-title">HVAC Unit #7 — Shut Down Successfully</div>
        <div className="demo-solved-sub">
          Contamination source isolated. Fan motor stopped. Awaiting filter replacement and zone clearance.
        </div>
      </div>
    </div>
  );
}

// ── Main DemoView ─────────────────────────────────────────────────────────────
export default function DemoView() {
  const [demoState, setDemoState]           = useState(DEMO_STATES.IDLE);
  const [arduinoConnected, setArduinoConnected] = useState(false);
  const [agentEvents, setAgentEvents]       = useState([]);
  const [readings, setReadings]             = useState(BASELINE_READINGS);
  const [diagnosis, setDiagnosis]           = useState(null);
  const [severity, setSeverity]             = useState(null);
  const [completedAgents, setCompletedAgents] = useState(0);

  const wsRef  = useRef(null);
  const esRef  = useRef(null);

  // ── Send command to Arduino via WebSocket ───────────────────────────────────
  const sendArduinoCommand = useCallback((command) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command }));
    }
  }, []);

  // ── Start mock investigation via SSE ────────────────────────────────────────
  const startInvestigation = useCallback(() => {
    if (demoState !== DEMO_STATES.IDLE) return;

    setDemoState(DEMO_STATES.INVESTIGATING);
    setAgentEvents([]);
    setDiagnosis(null);
    setSeverity(null);
    setCompletedAgents(0);

    const es = new EventSource('/api/demo/investigate');
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        const timestamp = new Date().toISOString();

        switch (event.type) {
          case 'SCENARIO_START':
            setReadings(event.readings);
            break;

          case 'AGENT_START':
            setAgentEvents(prev => [...prev, {
              type: 'AGENT_START',
              agent: event.agent,
              message: event.message,
              timestamp,
            }]);
            break;

          case 'AGENT_COMPLETE':
            setAgentEvents(prev => [...prev, {
              type: 'AGENT_COMPLETE',
              agent: event.agent,
              summary: event.summary,
              details: event.details,
              timestamp,
            }]);
            setCompletedAgents(n => n + 1);

            if (event.agent === 'SeverityAgent' && event.details?.severity) {
              setSeverity(event.details.severity);
            }
            if (event.agent === 'ResponseAgent' && event.details) {
              setDiagnosis({
                ...event.details.diagnosis,
                recommendedActions: event.details.recommendedActions,
                lotValueAtRisk: event.details.diagnosis?.lotValueAtRisk,
                isoClassViolation: 'YES — 2.85 p/m³ exceeds 0.5 p/m³ ISO Class 5 threshold',
              });
            }
            break;

          case 'INVESTIGATION_COMPLETE':
            setDemoState(DEMO_STATES.COMPLETE);
            es.close();
            esRef.current = null;
            break;

          case 'ERROR':
            console.error('Demo investigation error:', event.message);
            es.close();
            esRef.current = null;
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Failed to parse demo SSE event:', err);
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };
  }, [demoState]);

  // ── Handle "Solve Problem" button click ─────────────────────────────────────
  const handleSolve = useCallback(() => {
    setDemoState(DEMO_STATES.SOLVING);
    sendArduinoCommand('STOP_FAN');

    // If Arduino is not connected, resolve optimistically after 1.5s
    if (!arduinoConnected) {
      setTimeout(() => setDemoState(DEMO_STATES.SOLVED), 1500);
    }
    // If connected, wait for FAN_STOPPED confirmation from Arduino via WS
  }, [arduinoConnected, sendArduinoCommand]);

  // ── Reset demo (called after DEMO_RESET from Arduino) ───────────────────────
  const resetDemo = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setDemoState(DEMO_STATES.IDLE);
    setAgentEvents([]);
    setReadings(BASELINE_READINGS);
    setDiagnosis(null);
    setSeverity(null);
    setCompletedAgents(0);
  }, []);

  // ── WebSocket connection to serial bridge ────────────────────────────────────
  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[DemoView] WebSocket connected to serial bridge');
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);

          switch (msg.type) {
            case 'ARDUINO_STATUS':
              setArduinoConnected(msg.connected);
              break;

            case 'CONTAMINATION_DETECTED':
              // Arduino detected contamination — auto-start investigation
              setDemoState(prev => {
                if (prev === DEMO_STATES.IDLE) {
                  // Trigger investigation on next tick so state is IDLE when startInvestigation reads it
                  setTimeout(() => startInvestigation(), 0);
                }
                return prev;
              });
              break;

            case 'FAN_STOPPED':
              setDemoState(DEMO_STATES.SOLVED);
              break;

            case 'DEMO_RESET':
              resetDemo();
              break;

            default:
              break;
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setArduinoConnected(false);
        // Reconnect after 3s
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── When CONTAMINATION_DETECTED fires from WS, we need startInvestigation ───
  // Using a ref so the WS handler always sees the latest version
  const startInvestigationRef = useRef(startInvestigation);
  useEffect(() => {
    startInvestigationRef.current = startInvestigation;
  }, [startInvestigation]);

  // Re-wire WS handler when startInvestigation changes
  useEffect(() => {
    if (!wsRef.current) return;
    const originalOnMessage = wsRef.current.onmessage;
    wsRef.current.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'CONTAMINATION_DETECTED' && demoState === DEMO_STATES.IDLE) {
          startInvestigationRef.current();
        } else {
          // re-call the original handler for all other messages
          originalOnMessage?.(e);
        }
      } catch {
        originalOnMessage?.(e);
      }
    };
  }, [demoState]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isInvestigating = demoState === DEMO_STATES.INVESTIGATING;
  const isComplete      = demoState === DEMO_STATES.COMPLETE ||
                          demoState === DEMO_STATES.SOLVING   ||
                          demoState === DEMO_STATES.SOLVED;

  const diagnosisWithDetails = diagnosis ? {
    ...diagnosis,
    lotValueAtRisk:   '~$2.4M',
    isoClassViolation: 'YES — 2.85 p/m³ exceeds 0.5 p/m³ ISO Class 5 threshold',
  } : null;

  return (
    <div className="demo-view">

      {/* ── Header strip ── */}
      <div className="demo-header-strip">
        <div className="demo-header-left">
          <span className="demo-badge">⚡ PHYSICAL DEMO</span>
          <span className="demo-header-title">HVAC Unit #7 — Live Contamination Demo</span>
          <span className="demo-header-sub">ISO Class 5 Cleanroom · Arduino Model</span>
        </div>
        <div className="demo-header-right">
          <ArduinoStatus connected={arduinoConnected} />
          <LedStrip demoState={demoState} />
          {isInvestigating && (
            <div className="demo-progress-badge">
              <span className="spin" style={{ display: 'inline-block', marginRight: 4 }}>⟳</span>
              INVESTIGATING — {completedAgents}/7
            </div>
          )}
          {isComplete && demoState !== DEMO_STATES.SOLVED && (
            <div className="demo-complete-badge">⚠ CRITICAL — ACTION REQUIRED</div>
          )}
          {demoState === DEMO_STATES.SOLVED && (
            <div className="demo-solved-badge">✓ RESOLVED</div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="demo-main">

        {/* ── LEFT: Fab map + idle/solve/solved states ── */}
        <div className="demo-left">
          <div className="panel-header">
            <span className="panel-icon">🏭</span>
            <span className="panel-title">Cleanroom Floor — ISO Class 5</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              Unidirectional Laminar Flow →
            </span>
          </div>

          <div className="demo-fab-wrap">
            <FabMap readings={readings} activeScenario={isInvestigating || isComplete ? 'A' : null} />
          </div>

          <div className="airflow-footer">
            <span className="airflow-arrow">→</span>
            <span>Airflow direction: left to right (0.45 m/s)</span>
            <span className="airflow-sep">·</span>
            <span className="airflow-dot" style={{ background: '#22c55e' }} />Normal
            <span className="airflow-sep">·</span>
            <span className="airflow-dot" style={{ background: '#eab308' }} />Elevated
            <span className="airflow-sep">·</span>
            <span className="airflow-dot" style={{ background: '#ef4444' }} />Critical
          </div>

          {/* State-specific content below the map */}
          {demoState === DEMO_STATES.IDLE && (
            <IdleScreen
              arduinoConnected={arduinoConnected}
              onManualTrigger={startInvestigation}
            />
          )}

          {(demoState === DEMO_STATES.COMPLETE || demoState === DEMO_STATES.SOLVING) && (
            <SolveProblemButton
              onSolve={handleSolve}
              solving={demoState === DEMO_STATES.SOLVING}
            />
          )}

          {demoState === DEMO_STATES.SOLVED && <SolvedBanner />}
        </div>

        {/* ── RIGHT: Agent feed + diagnosis ── */}
        <div className="demo-right">
          <div className="demo-right-tabs">
            <div className="demo-right-tab active">
              🤖 Investigation
              {completedAgents > 0 && (
                <span className="tab-badge">{completedAgents}/7</span>
              )}
            </div>
            <div className="demo-right-tab" style={{ color: 'var(--text-muted)' }}>
              🔬 Diagnosis
              {diagnosis && <span className="tab-badge tab-badge-green">NEW</span>}
            </div>
          </div>

          {/* Show both feed and diagnosis stacked when complete */}
          <div className="demo-right-content">
            <AgentFeed
              agentEvents={agentEvents}
              isInvestigating={isInvestigating && agentEvents.length === 0}
            />
            {diagnosis && (
              <div className="demo-diagnosis-section">
                <div className="demo-diagnosis-divider">── Final Diagnosis ──</div>
                <DiagnosisCard
                  diagnosis={diagnosisWithDetails}
                  severity={severity}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
