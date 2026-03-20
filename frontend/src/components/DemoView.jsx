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

const MOCK_READINGS = {
  'lithography-bay':  { particles: 0.07, trend: 'stable', particleSize: '0.3µm' },
  'etch-chamber':     { particles: 0.09, trend: 'stable', particleSize: '0.3µm' },
  'deposition':       { particles: 0.08, trend: 'stable', particleSize: '0.3µm' },
  'cmp':              { particles: 0.06, trend: 'stable', particleSize: '0.3µm' },
  'metrology':        { particles: 0.08, trend: 'stable', particleSize: '0.3µm' },
  'clean-station':    { particles: 0.09, trend: 'stable', particleSize: '0.3µm' },
  'hvac-unit-7':      { particles: 2.85, trend: 'rising', particleSize: '0.3µm' },
  'chemical-storage': { particles: 1.92, trend: 'rising', particleSize: '0.3µm' },
};

// ── Client-side fallback mock steps (mirrors server DEMO_MOCK_STEPS + traces) ─
// Used when the SSE endpoint fails — guarantees the demo never gets stuck.
const CLIENT_MOCK_STEPS = [
  {
    delay: 2000,
    start:    { agent: 'SensorCoordinator', message: 'Aggregating all 8 zone sensor readings...' },
    complete: {
      agent:   'SensorCoordinator',
      summary: 'Detected 2 critical zones: hvac-unit-7 (2.85 p/m³), chemical-storage (1.92 p/m³). 6 zones nominal.',
      details: { criticalZones: ['hvac-unit-7'], elevatedZones: ['chemical-storage'], totalAffected: 2, dominantSize: '0.3µm' },
      trace: {
        thought:     'I need to aggregate particle count readings from all 8 cleanroom zones and flag any that exceed the ISO Class 5 threshold of 0.5 p/m³.',
        action:      'Query sensor database for all zone readings. Compare against ISO Class 5 baseline. Flag zones exceeding threshold.',
        observation: 'hvac-unit-7: 2.85 p/m³ (CRITICAL, 5.7× baseline). chemical-storage: 1.92 p/m³ (ELEVATED, 3.8× baseline). Remaining 6 zones within normal range.',
        answer:      '2 anomalous zones detected. hvac-unit-7 and chemical-storage both exceed ISO Class 5 limits. Forwarding to physics analysis.',
      },
    },
  },
  {
    delay: 3000,
    start:    { agent: 'PhysicsAgent', message: 'Tracing contamination upstream against laminar airflow (0.45 m/s)...' },
    complete: {
      agent:   'PhysicsAgent',
      summary: 'Traced source upstream to hvac-unit-7 (Col 2, Row 1). Spread: unidirectional-right via laminar flow.',
      details: { upstreamSource: 'hvac-unit-7', spreadPattern: 'unidirectional-right', candidateZones: ['hvac-unit-7', 'chemical-storage'] },
      trace: {
        thought:     'With contamination at hvac-unit-7 and chemical-storage, I need to trace the upstream source using laminar airflow physics. Airflow is unidirectional at 0.45 m/s left-to-right.',
        action:      'Apply reverse laminar flow vector model. Map particle dispersion upstream from critical zones. Identify origin using concentration gradient and zone positions.',
        observation: 'Highest concentration at hvac-unit-7 (Col 2, Row 1) with gradient decreasing downstream. chemical-storage is a direct downstream neighbor. Single-source pattern confirmed.',
        answer:      'Source traced to hvac-unit-7. Contamination spreading unidirectionally right via laminar flow at 0.45 m/s. Candidate zones: [hvac-unit-7, chemical-storage].',
      },
    },
  },
  {
    delay: 3000,
    start:    { agent: 'PatternAgent', message: 'Matching contamination signature to historical event database...' },
    complete: {
      agent:   'PatternAgent',
      summary: 'Matched HVAC_FILTER_FAILURE with 94% confidence. Gradual ramp-up signature, 0.3µm particles. 3 historical precedents.',
      details: { matchedType: 'HVAC_FILTER_FAILURE', patternConfidence: 94, spikeShape: 'gradual-ramp' },
      trace: {
        thought:     'I need to match the contamination signature — 0.3µm particles, gradual ramp-up at hvac-unit-7 — against the historical contamination event database to identify the failure mode.',
        action:      'Search historical database for events matching: particle size 0.3µm, source zone hvac-unit-7, gradual concentration increase. Compute confidence scores for top pattern matches.',
        observation: 'Found 3 historical precedents for HVAC_FILTER_FAILURE. Gradual ramp-up over 6-hour window, 0.3µm dominant size, HVAC zone origin. Pattern confidence: 94%.',
        answer:      'HVAC_FILTER_FAILURE matched with 94% confidence. Gradual ramp-up in 0.3µm range with 3 historical precedents confirms filter degradation as the root cause.',
      },
    },
  },
  {
    delay: 3000,
    start:    { agent: 'CorrelationAgent', message: 'Checking equipment maintenance logs for candidate zones...' },
    complete: {
      agent:   'CorrelationAgent',
      summary: 'HVAC Unit #7 filter overdue by 4 days (last serviced 94 days ago, interval 90 days). Primary candidate confirmed.',
      details: { primaryCandidate: 'hvac-unit-7', overdueCount: 1, maintenanceFingerprint: 'HVAC filter — 4 days overdue' },
      trace: {
        thought:     'I need to cross-reference candidate zones [hvac-unit-7, chemical-storage] against maintenance logs to find equipment overdue for servicing that correlates with the contamination event.',
        action:      'Pull maintenance records for hvac-unit-7 and chemical-storage. Check last service dates, scheduled intervals, and overdue status.',
        observation: 'hvac-unit-7 HVAC filter: last serviced 94 days ago, recommended interval 90 days. Overdue by 4 days. chemical-storage: all maintenance items current, no overdue found.',
        answer:      'HVAC Unit #7 filter is 4 days overdue for replacement. This directly correlates with the contamination source from physics analysis. Primary candidate confirmed: hvac-unit-7.',
      },
    },
  },
  {
    delay: 3000,
    start:    { agent: 'VerificationAgent', message: 'Cross-validating spread pattern consistency with proposed source...' },
    complete: {
      agent:   'VerificationAgent',
      summary: 'Consistency score: 96%. Downstream zone (chemical-storage) elevated as expected. Hypothesis CONFIRMED.',
      details: { proposedSource: 'hvac-unit-7', consistencyScore: 96, isConsistent: true },
      trace: {
        thought:     'I need to verify that hvac-unit-7 as the source is consistent with the observed spread pattern under current airflow conditions by running a forward simulation.',
        action:      'Simulate contamination spread from hvac-unit-7 using laminar flow model. Compare predicted downstream zones against actual observed elevated readings.',
        observation: 'Simulation predicts: hvac-unit-7 (critical), chemical-storage (elevated), remaining 6 zones unaffected. Actual observations match prediction exactly. Consistency score: 96%.',
        answer:      'Hypothesis CONFIRMED with 96% consistency. Observed spread pattern perfectly matches the simulated output from an hvac-unit-7 source. Downstream chemical-storage elevation validates the model.',
      },
    },
  },
  {
    delay: 3000,
    start:    { agent: 'SeverityAgent', message: 'Calculating risk score and lot value at risk...' },
    complete: {
      agent:   'SeverityAgent',
      summary: 'Severity: CRITICAL. Risk score: 87/100. Lot value at risk: ~$2.4M. ISO Class 5 violation confirmed.',
      details: { severity: 'CRITICAL', riskScore: 87, lotValueAtRisk: '~$2.4M', isoClassViolation: 'YES — 2.85 p/m³ exceeds 0.5 p/m³ threshold' },
      trace: {
        thought:     'I need to assess severity by calculating the risk score, estimating lot value at risk from current wafer processing state, and checking ISO Class 5 compliance status.',
        action:      'Calculate risk score from: contamination level (2.85 vs 0.5 p/m³ threshold), source confidence (94%), affected zones (2), active production lots. Cross-check ISO 14644-1 Class 5 limits.',
        observation: 'Risk score: 87/100. Contamination 5.7× ISO limit. 3 active wafer lots in affected zones, estimated value ~$2.4M. ISO Class 5 violation confirmed: 2.85 p/m³ exceeds 0.5 p/m³.',
        answer:      'Severity: CRITICAL. Risk score 87/100. Immediate action required to prevent further lot loss. ISO Class 5 violation is active. Total lot value at risk: ~$2.4M.',
      },
    },
  },
  {
    delay: 3000,
    start:    { agent: 'ResponseAgent', message: 'Generating prioritized remediation plan for engineer approval...' },
    complete: {
      agent:   'ResponseAgent',
      summary: '6 immediate actions generated. Source: HVAC Unit #7. Recommend immediate shutdown of HVAC unit. AWAITING ENGINEER APPROVAL.',
      details: {
        diagnosis: {
          source:           'hvac-unit-7',
          type:             'HVAC_FILTER_FAILURE',
          confidence:       94,
          maintenanceLink:  'HVAC filter overdue by 4 days — last serviced 94 days ago',
        },
        recommendedActions: [
          { priority: 1, action: 'Immediately shut down HVAC Unit #7 to halt contamination spread',                        urgency: 'IMMEDIATE', owner: 'Facilities Engineer',  estTime: '5 min'  },
          { priority: 2, action: 'Isolate affected zones (hvac-unit-7, chemical-storage) and halt wafer processing',       urgency: 'IMMEDIATE', owner: 'Fab Operator',          estTime: '10 min' },
          { priority: 3, action: 'Inspect and replace HVAC Unit #7 filter (94-day accumulation)',                         urgency: 'URGENT',    owner: 'Maintenance Tech',       estTime: '45 min' },
          { priority: 4, action: 'Deploy portable HEPA scrubbers in affected zones during HVAC downtime',                 urgency: 'URGENT',    owner: 'Facilities Engineer',  estTime: '30 min' },
          { priority: 5, action: 'Perform full particle count sweep of all 8 zones post-filter replacement',              urgency: 'URGENT',    owner: 'Metrology Team',         estTime: '60 min' },
          { priority: 6, action: 'Update HVAC maintenance schedule — reduce interval from 90 to 60 days',                 urgency: 'ROUTINE',   owner: 'Maintenance Manager',    estTime: '15 min' },
        ],
      },
      trace: {
        thought:     'With CRITICAL severity confirmed and hvac-unit-7 identified as the source, I need to generate a prioritized remediation plan covering immediate containment, root cause repair, and preventive follow-up.',
        action:      'Generate tiered action plan: immediate shutdown/isolation steps, urgent repair/cleaning steps, routine policy updates. Assign owners, estimate completion times, and set urgency levels.',
        observation: '6 actions generated. Actions 1-2 are immediate (stop contamination spread, <15 min). Actions 3-5 are urgent (root cause fix + verification, ~2.25 hrs). Action 6 is routine (policy update, 15 min).',
        answer:      'Remediation plan ready with 6 prioritized actions. Estimated full resolution: ~2.75 hours. Immediate actions 1-2 must be executed now to halt active ISO Class 5 violation. AWAITING ENGINEER APPROVAL.',
      },
    },
  },
];

// ── Demo states ───────────────────────────────────────────────────────────────
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
  const [demoState, setDemoState]               = useState(DEMO_STATES.IDLE);
  const [arduinoConnected, setArduinoConnected] = useState(false);
  const [agentEvents, setAgentEvents]           = useState([]);
  const [readings, setReadings]                 = useState(BASELINE_READINGS);
  const [diagnosis, setDiagnosis]               = useState(null);
  const [severity, setSeverity]                 = useState(null);
  const [completedAgents, setCompletedAgents]   = useState(0);
  const [usedFallback, setUsedFallback]         = useState(false);

  const wsRef                 = useRef(null);
  const esRef                 = useRef(null);
  const mockTimeoutsRef       = useRef([]);
  const investigationDoneRef  = useRef(false); // prevents onerror fallback after clean completion

  // ── Clear any in-progress fallback timers ───────────────────────────────────
  const clearMockTimeouts = useCallback(() => {
    mockTimeoutsRef.current.forEach(clearTimeout);
    mockTimeoutsRef.current = [];
  }, []);

  // ── Send command to Arduino via WebSocket ───────────────────────────────────
  const sendArduinoCommand = useCallback((command) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command }));
    }
  }, []);

  // ── Client-side mock fallback (runs when SSE fails) ──────────────────────────
  const runMockFallback = useCallback(() => {
    setUsedFallback(true);
    setReadings(MOCK_READINGS);

    let accDelay = 200;

    for (const step of CLIENT_MOCK_STEPS) {
      const startAt    = accDelay;
      const completeAt = accDelay + step.delay;

      const tStart = setTimeout(() => {
        setAgentEvents(prev => [...prev, {
          type:      'AGENT_START',
          agent:     step.start.agent,
          message:   step.start.message,
          timestamp: new Date().toISOString(),
        }]);
      }, startAt);

      const tComplete = setTimeout(() => {
        const timestamp = new Date().toISOString();
        setAgentEvents(prev => [...prev, {
          type:      'AGENT_COMPLETE',
          agent:     step.complete.agent,
          summary:   step.complete.summary,
          details:   step.complete.details,
          trace:     step.complete.trace,
          timestamp,
        }]);
        setCompletedAgents(n => n + 1);

        if (step.complete.agent === 'SeverityAgent' && step.complete.details?.severity) {
          setSeverity(step.complete.details.severity);
        }
        if (step.complete.agent === 'ResponseAgent' && step.complete.details) {
          setDiagnosis({
            ...step.complete.details.diagnosis,
            recommendedActions: step.complete.details.recommendedActions,
            lotValueAtRisk:     step.complete.details.diagnosis?.lotValueAtRisk ?? '~$2.4M',
            isoClassViolation:  'YES — 2.85 p/m³ exceeds 0.5 p/m³ ISO Class 5 threshold',
          });
        }
      }, completeAt);

      mockTimeoutsRef.current.push(tStart, tComplete);
      accDelay = completeAt + 800;
    }

    const tDone = setTimeout(() => {
      setDemoState(DEMO_STATES.COMPLETE);
    }, accDelay + 300);
    mockTimeoutsRef.current.push(tDone);
  }, []);

  // ── Look up the pre-scripted fallback data for a given agent ────────────────
  const getMockStep = (agentName) =>
    CLIENT_MOCK_STEPS.find(s => s.complete.agent === agentName);

  // ── Start real agent investigation (Scenario A), with null-field fallback ───
  const startInvestigation = useCallback(() => {
    if (demoState !== DEMO_STATES.IDLE) return;

    setDemoState(DEMO_STATES.INVESTIGATING);
    setAgentEvents([]);
    setDiagnosis(null);
    setSeverity(null);
    setCompletedAgents(0);
    setUsedFallback(false);
    investigationDoneRef.current = false;

    // Use the real agent pipeline — same as Cleanroom floor Scenario A
    const es = new EventSource('/api/investigate/A');
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event     = JSON.parse(e.data);
        const timestamp = new Date().toISOString();

        switch (event.type) {
          case 'SCENARIO_START':
            setReadings(event.readings);
            break;

          case 'AGENT_START':
            setAgentEvents(prev => [...prev, {
              type:      'AGENT_START',
              agent:     event.agent,
              message:   event.message,
              timestamp,
            }]);
            break;

          case 'AGENT_COMPLETE': {
            // Use real data; fall back to mock only for null/missing/empty fields
            const mock = getMockStep(event.agent);
            const summary = event.summary ?? mock?.complete.summary;
            const details = event.details ?? mock?.complete.details;
            const hasRealTrace = event.trace && Object.values(event.trace).some(Boolean);
            const trace = hasRealTrace ? event.trace : mock?.complete.trace;

            setAgentEvents(prev => [...prev, {
              type: 'AGENT_COMPLETE',
              agent: event.agent,
              summary,
              details,
              trace,
              timestamp,
            }]);
            setCompletedAgents(n => n + 1);

            if (event.agent === 'SeverityAgent' && details?.severity) {
              setSeverity(details.severity);
            }
            if (event.agent === 'ResponseAgent' && details) {
              setDiagnosis({
                ...details.diagnosis,
                recommendedActions: details.recommendedActions,
                lotValueAtRisk:     details.diagnosis?.lotValueAtRisk,
                isoClassViolation:  'YES — 2.85 p/m³ exceeds 0.5 p/m³ ISO Class 5 threshold',
              });
            }
            break;
          }

          case 'INVESTIGATION_COMPLETE':
            investigationDoneRef.current = true;  // block onerror fallback
            setDemoState(DEMO_STATES.COMPLETE);
            es.close();
            esRef.current = null;
            break;

          case 'ERROR':
            console.error('Demo investigation error:', event.message);
            es.close();
            esRef.current = null;
            // Server-reported error — fall back to full mock
            runMockFallback();
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
      // Only run mock if investigation didn't already complete cleanly.
      // (Browsers fire onerror when es.close() is called after INVESTIGATION_COMPLETE.)
      if (!investigationDoneRef.current) {
        runMockFallback();
      }
    };
  }, [demoState, runMockFallback]);

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
    clearMockTimeouts();
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
    setUsedFallback(false);
  }, [clearMockTimeouts]);

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
              // Arduino detected contamination — use ref so handler is never stale
              setDemoState(prev => {
                if (prev === DEMO_STATES.IDLE) {
                  setTimeout(() => startInvestigationRef.current(), 0);
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

  // ── Keep startInvestigation ref fresh so the WS handler never goes stale ─────
  const startInvestigationRef = useRef(startInvestigation);
  useEffect(() => {
    startInvestigationRef.current = startInvestigation;
  }, [startInvestigation]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isInvestigating = demoState === DEMO_STATES.INVESTIGATING;
  const isComplete      = demoState === DEMO_STATES.COMPLETE ||
                          demoState === DEMO_STATES.SOLVING   ||
                          demoState === DEMO_STATES.SOLVED;

  const diagnosisWithDetails = diagnosis ? {
    ...diagnosis,
    lotValueAtRisk:    diagnosis.lotValueAtRisk ?? '~$2.4M',
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
          {usedFallback && (
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', border: '1px solid #334155', borderRadius: 4, padding: '2px 8px', fontFamily: 'JetBrains Mono, monospace' }}>
              FALLBACK MODE
            </div>
          )}
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
