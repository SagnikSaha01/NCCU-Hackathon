import React, { useState, useRef, useCallback } from 'react';
import FabMap from './components/FabMap.jsx';
import AgentFeed from './components/AgentFeed.jsx';
import DiagnosisCard from './components/DiagnosisCard.jsx';
import SensorStatus from './components/SensorStatus.jsx';
import Timeline from './components/Timeline.jsx';
import ScenarioButtons from './components/ScenarioButtons.jsx';
import AgentFlowMap from './components/AgentFlowMap.jsx';

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

// Right-panel tabs (only shown on Cleanroom view)
const RIGHT_TABS = [
  { id: 'feed',      label: 'Investigation', icon: '🤖' },
  { id: 'sensors',   label: 'Sensors',       icon: '📡' },
  { id: 'diagnosis', label: 'Diagnosis',     icon: '🔬' },
];

// Top-level views
const VIEWS = [
  { id: 'cleanroom', label: 'Cleanroom Floor', icon: '🏭' },
  { id: 'pipeline',  label: 'Agent Pipeline',  icon: '🔀' },
];

export default function App() {
  const [activeScenario, setActiveScenario] = useState(null);
  const [readings, setReadings] = useState(BASELINE_READINGS);
  const [agentEvents, setAgentEvents] = useState([]);
  const [diagnosis, setDiagnosis] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [activeView, setActiveView] = useState('cleanroom');
  const [activeTab, setActiveTab] = useState('feed');
  const esRef = useRef(null);

  const triggerScenario = useCallback((key) => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setActiveScenario(key);
    setAgentEvents([]);
    setDiagnosis(null);
    setSeverity(null);
    setIsComplete(false);
    setIsInvestigating(true);
    setReadings(BASELINE_READINGS);
    setActiveTab('feed'); // Switch to feed when investigation starts

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
              setDiagnosis({
                ...event.details.diagnosis,
                recommendedActions: event.details.recommendedActions,
              });
              // Auto-switch to diagnosis tab when complete
              setTimeout(() => setActiveTab('diagnosis'), 800);
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

    es.onerror = () => {
      setIsInvestigating(false);
      es.close();
      esRef.current = null;
    };
  }, []);

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

  const completedAgents = agentEvents.filter(e => e.type === 'AGENT_COMPLETE').length;

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

        {/* ── Top-level view switcher (centred in header) ── */}
        <div className="main-view-tabs">
          {VIEWS.map(v => (
            <button
              key={v.id}
              className={`main-view-btn ${activeView === v.id ? 'active' : ''}`}
              onClick={() => setActiveView(v.id)}
            >
              <span>{v.icon}</span>
              <span>{v.label}</span>
              {v.id === 'pipeline' && isInvestigating && (
                <span className="main-view-pip" />
              )}
            </button>
          ))}
        </div>

        <div className="header-right">
          <div className="header-status">
            <div className="status-dot pulse" />
            8 zones monitored
          </div>
          <div className="header-status">
            <div className="status-dot" style={{ background: '#a855f7' }} />
            7 agents ready
          </div>
          {isInvestigating && (
            <div className="header-badge" style={{ borderColor: '#eab308', color: '#eab308', background: 'rgba(234,179,8,0.15)' }}>
              <span className="spin" style={{ display: 'inline-block', marginRight: 4 }}>⟳</span>
              INVESTIGATING — {completedAgents}/7
            </div>
          )}
          {isComplete && (
            <div className="header-badge" style={{ borderColor: '#22c55e', color: '#22c55e', background: 'rgba(34,197,94,0.15)' }}>
              ✓ COMPLETE
            </div>
          )}
          {severity && (
            <span className={`severity-badge severity-${severity}`} style={{ fontSize: '0.65rem', padding: '3px 10px' }}>
              {severity}
            </span>
          )}
        </div>
      </header>

      {/* ─── VIEW: Cleanroom Floor ─── */}
      {activeView === 'cleanroom' && (
        <div className="main-layout">

          {/* ── LEFT: Cleanroom Floor ── */}
          <div className="fab-panel">
            <div className="panel-header">
              <span className="panel-icon">🏭</span>
              <span className="panel-title">Cleanroom Floor — ISO Class 5</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                Unidirectional Laminar Flow →
              </span>
            </div>

            <div className="scenario-strip">
              <span className="scenario-strip-label">TRIGGER SCENARIO:</span>
              <ScenarioButtons
                activeScenario={activeScenario}
                onSelect={triggerScenario}
                disabled={isInvestigating}
                horizontal
              />
            </div>

            <div className="fab-map-fill">
              <FabMap readings={readings} activeScenario={activeScenario} />
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
          </div>

          {/* ── RIGHT: Tabbed Panel ── */}
          <div className="tab-panel">
            <div className="tab-bar">
              {RIGHT_TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.id === 'feed' && completedAgents > 0 && (
                    <span className="tab-badge">{completedAgents}/7</span>
                  )}
                  {tab.id === 'diagnosis' && diagnosis && (
                    <span className="tab-badge tab-badge-green">NEW</span>
                  )}
                </button>
              ))}
            </div>

            <div className="tab-content">
              {activeTab === 'feed' && (
                <AgentFeed
                  agentEvents={agentEvents}
                  isInvestigating={isInvestigating && agentEvents.length === 0}
                />
              )}
              {activeTab === 'sensors' && (
                <SensorStatus readings={readings} />
              )}
              {activeTab === 'diagnosis' && (
                <DiagnosisCard
                  diagnosis={diagnosisWithDetails}
                  severity={severity}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── VIEW: Agent Pipeline (full screen) ─── */}
      {activeView === 'pipeline' && (
        <div className="pipeline-view">
          <AgentFlowMap
            agentEvents={agentEvents}
            isInvestigating={isInvestigating}
          />
        </div>
      )}

      {/* ─── Timeline Footer ─── */}
      <Timeline
        isComplete={isComplete}
        aiTime="2 min 17 sec"
        manualTime="4-8 hours"
      />
    </div>
  );
}
