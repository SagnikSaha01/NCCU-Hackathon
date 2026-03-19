import React, { useEffect, useState } from 'react';

const LEVEL_CONFIG = {
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.35)',    icon: '🔴' },
  HIGH:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.35)',   icon: '⚠' },
  MEDIUM:   { color: '#eab308', bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.3)',     icon: '◈' },
  LOW:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.05)', border: 'rgba(148,163,184,0.2)',   icon: '○' },
};

const URGENCY_COLOR = {
  'immediate':     '#ef4444',
  'within 24hrs':  '#f97316',
  'within 1 week': '#eab308',
};

function timeAgo(iso) {
  if (!iso) return '';
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export default function PredictiveAlerts() {
  const [alerts, setAlerts]             = useState([]);
  const [lastPolledAt, setLastPolledAt] = useState(null);
  const [pollCount, setPollCount]       = useState(0);
  const [loading, setLoading]           = useState(true);

  async function fetchAlerts() {
    try {
      const res  = await fetch('/api/watchdog/alerts');
      const data = await res.json();
      setAlerts(data.alerts ?? []);
      setLastPolledAt(data.lastPolledAt);
      setPollCount(data.pollCount ?? 0);
    } catch {
      // backend may still be starting
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(id);
  }, []);

  const highestLevel = ['CRITICAL','HIGH','MEDIUM','LOW']
    .find(l => alerts.some(a => a.level === l));

  return (
    <div className="predictive-panel">
      <div className="predictive-header">
        <span className="predictive-title">
          <span className="predictive-pulse-dot" />
          Watchdog — Predictive Risk Monitor
        </span>
        <span className="predictive-meta">
          {loading ? 'initializing…' : `poll #${pollCount} · ${timeAgo(lastPolledAt)}`}
        </span>
      </div>

      {loading && (
        <div className="predictive-loading">
          <span className="spin" style={{ display: 'inline-block', marginRight: 6 }}>⟳</span>
          Running watchdog analysis…
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="predictive-nominal">
          <span style={{ fontSize: '1.2rem' }}>✓</span>
          All zones nominal — no predictive alerts.
        </div>
      )}

      {!loading && alerts.map((alert, i) => {
        const cfg = LEVEL_CONFIG[alert.level] ?? LEVEL_CONFIG.MEDIUM;
        const urgencyColor = URGENCY_COLOR[alert.urgency] ?? '#94a3b8';

        return (
          <div
            key={i}
            className="predictive-alert"
            style={{ borderColor: cfg.border, background: cfg.bg }}
          >
            {/* Header row */}
            <div className="predictive-alert-header">
              <span className="predictive-alert-icon">{cfg.icon}</span>
              <span className="predictive-alert-zone" style={{ color: cfg.color }}>
                {alert.zone}
              </span>
              <span className="predictive-alert-level" style={{ color: cfg.color, borderColor: cfg.border }}>
                {alert.level}
              </span>
              {alert.urgency && (
                <span className="predictive-alert-urgency" style={{ color: urgencyColor }}>
                  {alert.urgency}
                </span>
              )}
            </div>

            {/* Equipment */}
            {alert.equipment && (
              <div className="predictive-alert-equipment">{alert.equipment}</div>
            )}

            {/* Reason */}
            {alert.reason && (
              <div className="predictive-alert-reason">{alert.reason}</div>
            )}

            {/* Stats row */}
            <div className="predictive-alert-stats">
              {alert.daysOverdue != null && alert.daysOverdue > 0 && (
                <span className="predictive-stat" style={{ color: cfg.color, borderColor: cfg.border }}>
                  {alert.daysOverdue}d overdue
                </span>
              )}
              {alert.driftPercent != null && alert.driftPercent > 0 && (
                <span className="predictive-stat">
                  +{alert.driftPercent}% drift
                </span>
              )}
              {alert.historicalPrecedent && (
                <span className="predictive-stat">
                  ⟳ precedent: {alert.historicalPrecedent}
                </span>
              )}
              {alert.downstreamZones?.length > 0 && (
                <span className="predictive-stat">
                  ↓ {alert.downstreamZones.join(', ')}
                </span>
              )}
            </div>

            {/* Recommended action */}
            {alert.recommendedAction && (
              <div className="predictive-alert-action">
                <span className="predictive-action-label">ACTION</span>
                {alert.recommendedAction}
              </div>
            )}
          </div>
        );
      })}

      {highestLevel && (highestLevel === 'CRITICAL' || highestLevel === 'HIGH') && (
        <div className="predictive-footer" style={{
          color: LEVEL_CONFIG[highestLevel].color,
          background: LEVEL_CONFIG[highestLevel].bg,
          borderColor: LEVEL_CONFIG[highestLevel].border,
        }}>
          {highestLevel === 'CRITICAL' ? '🔴' : '⚠'} {highestLevel} risk detected — trigger a scenario to confirm with the investigation pipeline.
        </div>
      )}
    </div>
  );
}
