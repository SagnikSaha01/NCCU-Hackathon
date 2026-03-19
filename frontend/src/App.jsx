import React, { useState, useRef, useCallback } from 'react';
import FabMap from './components/FabMap.jsx';
import AgentFeed from './components/AgentFeed.jsx';
import DiagnosisCard from './components/DiagnosisCard.jsx';
import Timeline from './components/Timeline.jsx';
import ScenarioButtons from './components/ScenarioButtons.jsx';

const BASELINE_READINGS = {
  'lithography-bay': { particles: 0.07, trend: 'stable', particleSize: '0.3µm' },
  'etch-chamber':    { particles: 0.09, trend: 'stable', particleSize: '0.3µm' },
  'deposition':      { particles: 0.08, trend: 'stable', particleSize: '0.3µm' },
  'cmp':             { particles: 0.06, trend: 'stable', particleSize: '0.3µm' },
  'metrology':       { particles: 0.08, trend: 'stable', particleSize: '0.3µm' },
  'clean-station':   { particles: 0.09, trend: 'stable', particleSize: '0.3µm' },
  'hvac-unit-7':     { particles: 0.07, trend: 'stable', particleSize: '0.3µm' },
  'chemical-storage':{ particles: 0.06, trend: 'stable', particleSize: '0.3µm' },
};

export default function App() {
  const [activeScenario, setActiveScenario] = useState(null);
  const [readings, setReadings] = useState(BASELINE_READINGS);
  const [agentEvents, setAgentEvents] = useState([]);
  const [diagnosis, setDiagnosis] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const esRef = useRef(null);

  const triggerScenario = useCallback((key) => {
    // Close any existing EventSource
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    // Reset state
    setActiveScenario(key);
    setAgentEvents([]);
    setDiagnosis(null);
    setSeverity(null);
    setIsComplete(false);
    setIsInvestigating(true);
    setReadings(BASELINE_READINGS);

    const es = new EventSource(`/api/investigate/${key}`);
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

            if (event.agent === 'SeverityAgent' && event.details?.severity) {
              setSeverity(event.details.severity);
            }

            if (event.agent === 'ResponseAgent' && event.details) {
              // Merge severityAgent data we already have into diagnosis
              setDiagnosis(prev => ({
                ...event.details.diagnosis,
                recommendedActions: event.details.recommendedActions,
              }));
            }
            break;

          case 'INVESTIGATION_COMPLETE':
            setIsComplete(true);
            setIsInvestigating(false);
            es.close();
            esRef.current = null;
            break;

          case 'ERROR':
            console.error('Investigation error:', event.message);
            setIsInvestigating(false);
            es.close();
            esRef.current = null;
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    es.onerror = (err) => {
      console.error('EventSource error:', err);
      setIsInvestigating(false);
      es.close();
      esRef.current = null;
    };
  }, []);

  // Build diagnosis with severity from SeverityAgent output
  const diagnosisWithDetails = diagnosis
    ? {
        ...diagnosis,
        lotValueAtRisk: agentEvents
          .find(e => e.agent === 'SeverityAgent' && e.type === 'AGENT_COMPLETE')
          ?.details?.lotValueAtRisk,
        isoClassViolation: agentEvents
          .find(e => e.agent === 'SeverityAgent' && e.type === 'AGENT_COMPLETE')
          ?.details?.isoClassViolation,
      }
    : null;

  return (
    <div className="app">
      {/* ─── Header ─── */}
      <header className="header">
        <div className="header-left">
          <div>
            <div className="header-title">
              <span>Contamination</span>Hunter
            </div>
            <div className="header-subtitle">
              Semiconductor Fab Contamination Detection System
            </div>
          </div>
          <div className="header-badge">IBM watsonx Orchestrate</div>
        </div>
        <div className="header-right">
          <div className="header-status">
            <div className="status-dot pulse" />
            8 zones monitored
          </div>
          <div className="header-status" style={{ marginLeft: 8 }}>
            <div className="status-dot" style={{ background: '#a855f7' }} />
            7 agents ready
          </div>
          {isInvestigating && (
            <div className="header-badge" style={{ borderColor: '#eab308', color: '#eab308', background: 'rgba(234,179,8,0.15)' }}>
              <span className="spin" style={{ display: 'inline-block', marginRight: 4 }}>⟳</span>
              INVESTIGATING
            </div>
          )}
          {isComplete && (
            <div className="header-badge" style={{ borderColor: '#22c55e', color: '#22c55e', background: 'rgba(34,197,94,0.15)' }}>
              COMPLETE
            </div>
          )}
        </div>
      </header>

      {/* ─── Main Layout ─── */}
      <div className="main-layout">
        {/* LEFT PANEL: Fab Map + Scenario Buttons */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-icon">🏭</span>
            <span className="panel-title">Fab Floor Monitor</span>
          </div>

          <ScenarioButtons
            activeScenario={activeScenario}
            onSelect={triggerScenario}
            disabled={isInvestigating}
          />

          <div className="fab-map-wrapper">
            <div className="fab-title">CLEANROOM FLOOR — ISO CLASS 5</div>
            <div className="fab-svg-container">
              <FabMap readings={readings} activeScenario={activeScenario} />
            </div>
            <div className="airflow-label">
              → Airflow: Unidirectional Laminar Flow (ISO Class 5)
            </div>
          </div>
        </div>

        {/* CENTER PANEL: Agent Feed */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-icon">🤖</span>
            <span className="panel-title">Agent Investigation Feed</span>
            {agentEvents.length > 0 && (
              <span style={{
                marginLeft: 'auto',
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                fontFamily: 'JetBrains Mono, monospace'
              }}>
                {agentEvents.filter(e => e.type === 'AGENT_COMPLETE').length}/7 agents complete
              </span>
            )}
          </div>
          <AgentFeed
            agentEvents={agentEvents}
            isInvestigating={isInvestigating && agentEvents.length === 0}
          />
        </div>

        {/* RIGHT PANEL: Diagnosis */}
        <div className="panel" style={{ borderRight: 'none' }}>
          <div className="panel-header">
            <span className="panel-icon">🔬</span>
            <span className="panel-title">Diagnosis & Response Plan</span>
            {severity && (
              <span className={`severity-badge severity-${severity}`} style={{ marginLeft: 'auto', fontSize: '0.62rem', padding: '2px 8px' }}>
                {severity}
              </span>
            )}
          </div>
          <DiagnosisCard
            diagnosis={diagnosisWithDetails}
            severity={severity}
          />
        </div>
      </div>

      {/* ─── Timeline Footer ─── */}
      <Timeline
        isComplete={isComplete}
        aiTime="2 min 17 sec"
        manualTime="4-8 hours"
      />
    </div>
  );
}
