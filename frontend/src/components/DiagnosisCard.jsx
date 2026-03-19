import React, { useState, useEffect } from 'react';

function formatZoneName(zoneId) {
  if (!zoneId) return 'Unknown';
  return zoneId
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace('Hvac', 'HVAC')
    .replace('Cmp', 'CMP');
}

function formatType(type) {
  if (!type) return '';
  const map = {
    HVAC_FILTER_FAILURE: 'HVAC Filter Failure',
    TOOL_SEAL_BREACH: 'Tool Seal Breach',
    CHEMICAL_OUTGASSING: 'Chemical Outgassing',
  };
  return map[type] || type.replace(/_/g, ' ');
}

function UrgencyTag({ urgency }) {
  const cls = urgency === 'IMMEDIATE' ? 'immediate' : urgency === 'URGENT' ? 'urgent' : 'routine';
  return <span className={`action-tag ${cls}`}>{urgency}</span>;
}

export default function DiagnosisCard({ diagnosis, severity }) {
  const [confidencePct, setConfidencePct] = useState(0);

  useEffect(() => {
    if (diagnosis && diagnosis.confidence) {
      // Animate confidence bar after mount
      const timer = setTimeout(() => {
        setConfidencePct(diagnosis.confidence);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setConfidencePct(0);
    }
  }, [diagnosis]);

  if (!diagnosis) {
    return (
      <div className="diagnosis-card">
        <div className="no-diagnosis">
          <div className="no-diagnosis-icon">🔬</div>
          <div className="no-diagnosis-text">
            Run a scenario to begin the contamination investigation
          </div>
        </div>
      </div>
    );
  }

  const {
    source,
    type,
    confidence,
    maintenanceLink,
  } = diagnosis;

  const actions = diagnosis.recommendedActions || [];
  const lotValueAtRisk = diagnosis.lotValueAtRisk;
  const isoViolation = diagnosis.isoClassViolation;

  return (
    <div className="diagnosis-card">
      {/* Source */}
      <div className="diagnosis-source">
        <div className="diagnosis-label">Contamination Source</div>
        <div className="diagnosis-value">{formatZoneName(source)}</div>
        <div className="diagnosis-type">{formatType(type)}</div>

        {/* Confidence bar */}
        <div className="confidence-bar-wrap">
          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          <div className="confidence-pct">Confidence: {confidence}%</div>
        </div>
      </div>

      {/* Severity */}
      {severity && (
        <div className="info-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="info-row-label">Severity Level</div>
          </div>
          <span className={`severity-badge severity-${severity}`}>
            {severity === 'CRITICAL' && '🔴'}
            {severity === 'HIGH' && '🟠'}
            {severity === 'MEDIUM' && '🟡'}
            {severity === 'LOW' && '🟢'}
            {severity}
          </span>
        </div>
      )}

      {/* Lot value */}
      {lotValueAtRisk && (
        <div className="info-row">
          <div className="info-row-label">Lot Value at Risk</div>
          <div className="info-row-value highlight">{lotValueAtRisk}</div>
        </div>
      )}

      {/* ISO violation */}
      {isoViolation && (
        <div className="info-row">
          <div className="info-row-label">ISO Class 5 Violation</div>
          <div className="info-row-value" style={{ color: isoViolation.startsWith('YES') ? 'var(--accent-red)' : 'var(--accent-green)' }}>
            {isoViolation}
          </div>
        </div>
      )}

      {/* Maintenance link */}
      {maintenanceLink && (
        <div className="info-row">
          <div className="info-row-label">Maintenance Correlation</div>
          <div className="info-row-value" style={{ fontSize: '0.75rem', color: 'var(--accent-yellow)' }}>
            {maintenanceLink}
          </div>
        </div>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <>
          <div className="actions-header">Recommended Actions</div>
          <div className="actions-list">
            {actions.map(action => (
              <div key={action.priority} className="action-item">
                <div className="action-priority">PRIORITY {action.priority}</div>
                <div className="action-text">{action.action}</div>
                <div className="action-meta">
                  <UrgencyTag urgency={action.urgency} />
                  <span className="action-owner">{action.owner}</span>
                  <span className="action-time">{action.estTime}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Disclaimer */}
      <div className="disclaimer-banner">
        RECOMMENDATIONS ONLY — Awaiting authorized engineer approval before execution
      </div>
    </div>
  );
}
