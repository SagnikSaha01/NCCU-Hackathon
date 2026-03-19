import React, { useState, useEffect } from 'react';

const LEVEL_COLORS = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#94a3b8',
  NOMINAL:  '#22c55e',
  NORMAL:   '#22c55e',
};

function levelColor(level) {
  return LEVEL_COLORS[level?.toUpperCase()] ?? '#94a3b8';
}

function LevelBadge({ level }) {
  const color = levelColor(level);
  return (
    <span style={{
      fontSize: '0.6rem',
      fontWeight: 700,
      fontFamily: 'JetBrains Mono, monospace',
      letterSpacing: '0.08em',
      padding: '2px 8px',
      borderRadius: 4,
      border: `1px solid ${color}`,
      color,
      background: `${color}22`,
      flexShrink: 0,
    }}>
      {level}
    </span>
  );
}

function AlertCard({ alert }) {
  const color = levelColor(alert.level);
  return (
    <div style={{
      background: 'var(--bg-card, #131d35)',
      border: `1px solid ${color}44`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: '0.8rem', color, fontFamily: 'JetBrains Mono, monospace' }}>
          {alert.zone}
        </span>
        <LevelBadge level={alert.level} />
        {alert.urgency && (
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>
            {alert.urgency}
          </span>
        )}
      </div>

      {alert.equipment && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: 5 }}>
          {alert.equipment}
        </div>
      )}

      <div style={{ fontSize: '0.73rem', color: 'var(--text-primary, #e2e8f0)', marginBottom: 8, lineHeight: 1.5 }}>
        {alert.reason}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        {alert.daysOverdue != null && (
          <div style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ color: 'var(--text-muted)' }}>OVERDUE </span>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>{alert.daysOverdue}d</span>
          </div>
        )}
        {alert.driftPercent != null && (
          <div style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ color: 'var(--text-muted)' }}>DRIFT </span>
            <span style={{ color: '#f97316', fontWeight: 700 }}>+{alert.driftPercent}%</span>
          </div>
        )}
      </div>

      {alert.recommendedAction && (
        <div style={{
          background: 'rgba(14,165,233,0.08)',
          border: '1px solid rgba(14,165,233,0.2)',
          borderRadius: 5,
          padding: '6px 10px',
          marginBottom: 8,
        }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#0ea5e9', fontFamily: 'JetBrains Mono, monospace', marginRight: 6 }}>
            ACTION
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-primary, #e2e8f0)' }}>
            {alert.recommendedAction}
          </span>
        </div>
      )}

      {alert.downstreamZones?.length > 0 && (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', marginRight: 4 }}>DOWNSTREAM:</span>
          {alert.downstreamZones.map((z, i) => (
            <span key={z}>
              <span style={{ color: '#f97316' }}>{z}</span>
              {i < alert.downstreamZones.length - 1 && <span style={{ color: 'var(--text-muted)' }}>, </span>}
            </span>
          ))}
        </div>
      )}

      {alert.historicalPrecedent && (
        <div style={{
          fontSize: '0.65rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border, #1e2d4a)',
          paddingTop: 6,
          marginTop: 4,
          fontStyle: 'italic',
        }}>
          Historical: {alert.historicalPrecedent}
        </div>
      )}
    </div>
  );
}

function TracePanel({ trace }) {
  if (!trace) return (
    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
      No trace available (local computation mode).
    </div>
  );

  const steps = [
    { label: 'THOUGHT',     value: trace.thought },
    { label: 'ACTION',      value: trace.action },
    { label: 'OBSERVATION', value: trace.observation },
    { label: 'ANSWER',      value: trace.answer },
  ].filter(s => s.value);

  return (
    <div className="trace-panel" style={{ marginTop: 6 }}>
      {steps.map(step => (
        <div key={step.label} className="trace-step">
          <div className="trace-label">{step.label}</div>
          <div className="trace-value">{step.value}</div>
        </div>
      ))}
    </div>
  );
}

function MetricsPanel({ metricsSnapshot }) {
  if (!metricsSnapshot) return null;
  const { maintenanceSchedule = [], sensorDrift = [] } = metricsSnapshot;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6, letterSpacing: '0.08em' }}>
        MAINTENANCE SCHEDULE
      </div>
      <table style={{ width: '100%', fontSize: '0.68rem', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)' }}>
            <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 600 }}>Zone</th>
            <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 600 }}>Equipment</th>
            <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 600 }}>Days</th>
            <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 600 }}>Interval</th>
            <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 600 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {maintenanceSchedule.map(m => {
            const overdue = m.daysSince - m.interval;
            const isOverdue = overdue > 0;
            return (
              <tr key={m.zone} style={{ borderTop: '1px solid var(--border, #1e2d4a)' }}>
                <td style={{ padding: '3px 6px', fontFamily: 'JetBrains Mono, monospace', color: '#0ea5e9' }}>{m.zone}</td>
                <td style={{ padding: '3px 6px', color: 'var(--text-primary, #e2e8f0)' }}>{m.equipment}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--text-secondary, #94a3b8)' }}>{m.daysSince}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--text-secondary, #94a3b8)' }}>{m.interval}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right', color: isOverdue ? '#ef4444' : '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>
                  {isOverdue ? `+${overdue}d OVERDUE` : `${m.interval - m.daysSince}d left`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {sensorDrift.length > 0 && (
        <>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6, letterSpacing: '0.08em' }}>
            SENSOR DRIFT
          </div>
          <table style={{ width: '100%', fontSize: '0.68rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 600 }}>Zone</th>
                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 600 }}>Baseline</th>
                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 600 }}>Current</th>
                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 600 }}>Drift</th>
              </tr>
            </thead>
            <tbody>
              {sensorDrift.map(d => {
                const pct = Math.round(((d.current - d.baseline) / d.baseline) * 100);
                return (
                  <tr key={d.zone} style={{ borderTop: '1px solid var(--border, #1e2d4a)' }}>
                    <td style={{ padding: '3px 6px', fontFamily: 'JetBrains Mono, monospace', color: '#0ea5e9' }}>{d.zone}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--text-secondary, #94a3b8)' }}>{d.baseline}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--text-secondary, #94a3b8)' }}>{d.current}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', color: pct > 30 ? '#f97316' : '#eab308', fontFamily: 'JetBrains Mono, monospace' }}>
                      +{pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function PollEntry({ poll }) {
  const [showTrace,   setShowTrace]   = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);

  const color = levelColor(poll.overallRiskLevel);
  const ts = new Date(poll.timestamp);
  const formatted = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{
      background: 'var(--bg-card, #131d35)',
      border: '1px solid var(--border, #1e2d4a)',
      borderRadius: 8,
      padding: '10px 14px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          #{poll.pollNumber}
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--text-secondary, #94a3b8)' }}>
          {formatted}
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          {poll.durationMs}ms
        </span>
        <LevelBadge level={poll.overallRiskLevel} />
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
          {poll.alerts?.length ?? 0} alert{poll.alerts?.length !== 1 ? 's' : ''}
        </span>
      </div>

      {poll.summary && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-primary, #e2e8f0)', marginBottom: 8, lineHeight: 1.5 }}>
          {poll.summary}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setShowTrace(v => !v)}
          style={{
            fontSize: '0.62rem',
            fontFamily: 'JetBrains Mono, monospace',
            background: showTrace ? 'rgba(14,165,233,0.15)' : 'transparent',
            border: '1px solid rgba(14,165,233,0.3)',
            borderRadius: 4,
            color: '#0ea5e9',
            cursor: 'pointer',
            padding: '2px 8px',
          }}
        >
          {showTrace ? '▼' : '▶'} View reasoning
        </button>
        <button
          onClick={() => setShowMetrics(v => !v)}
          style={{
            fontSize: '0.62rem',
            fontFamily: 'JetBrains Mono, monospace',
            background: showMetrics ? 'rgba(168,85,247,0.15)' : 'transparent',
            border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: 4,
            color: '#a855f7',
            cursor: 'pointer',
            padding: '2px 8px',
          }}
        >
          {showMetrics ? '▼' : '▶'} View metrics
        </button>
      </div>

      {showTrace && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border, #1e2d4a)', paddingTop: 8 }}>
          <TracePanel trace={poll.trace} />
        </div>
      )}

      {showMetrics && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border, #1e2d4a)', paddingTop: 8 }}>
          <MetricsPanel metricsSnapshot={poll.metricsSnapshot} />
        </div>
      )}
    </div>
  );
}

export default function WatchdogView() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchState() {
    try {
      const res  = await fetch('/api/watchdog/alerts');
      const data = await res.json();
      setState(data);
    } catch (err) {
      console.error('[WatchdogView] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 30_000);
    return () => clearInterval(id);
  }, []);

  const polls        = state?.polls ?? [];
  const latestAlerts = state?.latestAlerts ?? [];
  const pollCount    = state?.pollCount ?? 0;
  const lastPolledAt = state?.lastPolledAt ?? null;
  const overallRisk  = polls[0]?.overallRiskLevel ?? 'NOMINAL';
  const riskColor    = levelColor(overallRisk);

  const lastPolledFormatted = lastPolledAt
    ? new Date(lastPolledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 12,
        color: 'var(--text-muted)',
      }}>
        <span className="spin" style={{ display: 'inline-block', fontSize: '1.5rem' }}>⟳</span>
        <span style={{ fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace' }}>Initializing watchdog...</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-dark, #0a0e1a)',
      overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 18px',
        background: 'var(--bg-panel, #0f1629)',
        borderBottom: '1px solid var(--border, #1e2d4a)',
        flexShrink: 0,
      }}>
        {/* Overall risk badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 6,
          border: `1px solid ${riskColor}`,
          background: `${riskColor}18`,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: riskColor, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: riskColor, letterSpacing: '0.08em' }}>
            {overallRisk}
          </span>
        </div>

        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' }}>
            Watchdog — Predictive Risk Monitor
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            IBM watsonx Orchestrate · Maintenance & Sensor Analysis
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>POLLS </span>
            <span style={{ color: '#0ea5e9', fontWeight: 700 }}>{pollCount}</span>
          </div>
          <div style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>LAST </span>
            <span style={{ color: 'var(--text-primary, #e2e8f0)' }}>{lastPolledFormatted}</span>
          </div>
          {/* Pulsing dot */}
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#22c55e',
            display: 'inline-block',
            boxShadow: '0 0 0 0 rgba(34,197,94,0.6)',
            animation: 'pulse 2s infinite',
          }} className="status-dot pulse" />
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left column — Active Alerts (40%) */}
        <div style={{
          width: '40%',
          flexShrink: 0,
          borderRight: '1px solid var(--border, #1e2d4a)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div className="panel-header" style={{ flexShrink: 0 }}>
            <span className="panel-icon">🚨</span>
            <span className="panel-title">Active Alerts</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {latestAlerts.length} active
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {latestAlerts.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 8,
                color: 'var(--text-muted)',
              }}>
                <span style={{ fontSize: '1.5rem' }}>✓</span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>No active alerts</span>
              </div>
            ) : (
              latestAlerts.map((alert, i) => (
                <AlertCard key={`${alert.zone}-${i}`} alert={alert} />
              ))
            )}
          </div>
        </div>

        {/* Right column — Poll History (60%) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div className="panel-header" style={{ flexShrink: 0 }}>
            <span className="panel-icon">📋</span>
            <span className="panel-title">Poll History</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              last {polls.length} of {pollCount}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {polls.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 8,
                color: 'var(--text-muted)',
              }}>
                <span className="spin" style={{ display: 'inline-block', fontSize: '1.2rem' }}>⟳</span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace' }}>Waiting for first poll...</span>
              </div>
            ) : (
              polls.map(poll => (
                <PollEntry key={poll.pollNumber} poll={poll} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
