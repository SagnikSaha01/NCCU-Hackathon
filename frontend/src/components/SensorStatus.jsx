import React from 'react';

const ZONES = [
  { id: 'lithography-bay', name: 'Lithography Bay', abbr: 'LITHO', row: 0, col: 0 },
  { id: 'etch-chamber',    name: 'Etch Chamber',    abbr: 'ETCH',  row: 0, col: 1 },
  { id: 'deposition',      name: 'Deposition',      abbr: 'DEP',   row: 0, col: 2 },
  { id: 'cmp',             name: 'CMP',             abbr: 'CMP',   row: 0, col: 3 },
  { id: 'metrology',       name: 'Metrology',       abbr: 'METRO', row: 1, col: 0 },
  { id: 'clean-station',   name: 'Clean Station',   abbr: 'CLEAN', row: 1, col: 1 },
  { id: 'hvac-unit-7',     name: 'HVAC Unit #7',    abbr: 'HVAC',  row: 1, col: 2 },
  { id: 'chemical-storage',name: 'Chemical Storage',abbr: 'CHEM',  row: 1, col: 3 },
];

const MAINTENANCE = {
  'lithography-bay':  { lastServiced: 45, overdueAt: 90, status: 'OK',      equipment: 'Exposure Unit A' },
  'etch-chamber':     { lastServiced: 62, overdueAt: 60, status: 'OVERDUE', equipment: 'Dry Etch Tool #3' },
  'deposition':       { lastServiced: 30, overdueAt: 90, status: 'OK',      equipment: 'CVD Reactor #2' },
  'cmp':              { lastServiced: 55, overdueAt: 90, status: 'OK',      equipment: 'CMP Polisher' },
  'metrology':        { lastServiced: 10, overdueAt: 90, status: 'OK',      equipment: 'CD-SEM' },
  'clean-station':    { lastServiced: 20, overdueAt: 60, status: 'OK',      equipment: 'Wet Bench #4' },
  'hvac-unit-7':      { lastServiced: 94, overdueAt: 90, status: 'OVERDUE', equipment: 'HEPA Filter Array' },
  'chemical-storage': { lastServiced: 78, overdueAt: 90, status: 'OK',      equipment: 'Chemical Cabinet Seals' },
};

function getLevel(particles) {
  if (particles > 1.0) return { label: 'CRITICAL', cls: 'critical' };
  if (particles > 0.3)  return { label: 'ELEVATED', cls: 'elevated' };
  return { label: 'NORMAL', cls: 'normal' };
}

function getTrend(trend) {
  if (trend === 'spiking')           return { symbol: '▲▲▲', color: '#ef4444' };
  if (trend === 'rising')            return { symbol: '▲',   color: '#eab308' };
  if (trend === 'slightly-elevated') return { symbol: '↑',   color: '#eab308' };
  return { symbol: '─', color: '#475569' };
}

export default function SensorStatus({ readings = {} }) {
  const now = new Date().toLocaleTimeString('en-US', { hour12: false });

  // Summary counts
  const critical = ZONES.filter(z => (readings[z.id]?.particles ?? 0.07) > 1.0).length;
  const elevated = ZONES.filter(z => {
    const p = readings[z.id]?.particles ?? 0.07;
    return p > 0.3 && p <= 1.0;
  }).length;
  const normal = 8 - critical - elevated;

  return (
    <div className="sensor-status">
      {/* Summary bar */}
      <div className="sensor-summary">
        <div className="sensor-summary-item">
          <span className="sensor-summary-dot" style={{ background: '#22c55e' }} />
          <span className="sensor-summary-count" style={{ color: '#22c55e' }}>{normal}</span>
          <span className="sensor-summary-label">Normal</span>
        </div>
        <div className="sensor-summary-item">
          <span className="sensor-summary-dot" style={{ background: '#eab308' }} />
          <span className="sensor-summary-count" style={{ color: '#eab308' }}>{elevated}</span>
          <span className="sensor-summary-label">Elevated</span>
        </div>
        <div className="sensor-summary-item">
          <span className="sensor-summary-dot" style={{ background: '#ef4444' }} />
          <span className="sensor-summary-count" style={{ color: '#ef4444' }}>{critical}</span>
          <span className="sensor-summary-label">Critical</span>
        </div>
        <span className="sensor-summary-time">Updated {now}</span>
      </div>

      {/* Threshold legend */}
      <div className="sensor-threshold-bar">
        <span className="threshold-item normal-threshold">Normal &lt;0.3</span>
        <span className="threshold-sep">·</span>
        <span className="threshold-item elevated-threshold">Elevated 0.3–1.0</span>
        <span className="threshold-sep">·</span>
        <span className="threshold-item critical-threshold">Critical &gt;1.0 p/m³</span>
      </div>

      {/* Zone cards */}
      <div className="sensor-grid">
        {ZONES.map(zone => {
          const reading = readings[zone.id];
          const particles = reading?.particles ?? 0.07;
          const trend = reading?.trend ?? 'stable';
          const particleSize = reading?.particleSize ?? '0.3µm';
          const level = getLevel(particles);
          const trendInfo = getTrend(trend);
          const maint = MAINTENANCE[zone.id];
          const maintPct = Math.min(100, Math.round((maint.lastServiced / maint.overdueAt) * 100));

          return (
            <div key={zone.id} className={`sensor-card sensor-card-${level.cls}`}>
              <div className="sensor-card-header">
                <div className="sensor-card-left">
                  <div className={`sensor-dot sensor-dot-${level.cls} ${particles > 0.3 ? 'pulse' : ''}`} />
                  <div>
                    <div className="sensor-zone-name">{zone.name}</div>
                    <div className="sensor-zone-abbr">{zone.abbr} · Col {zone.col}</div>
                  </div>
                </div>
                <span className={`sensor-level-badge level-${level.cls}`}>{level.label}</span>
              </div>

              <div className="sensor-readings">
                <div className="sensor-reading-main">
                  <span className={`sensor-particles level-${level.cls}`}>
                    {particles.toFixed(3)}
                  </span>
                  <span className="sensor-unit">p/m³</span>
                  <span className="sensor-trend" style={{ color: trendInfo.color }}>
                    {trendInfo.symbol}
                  </span>
                </div>
                <div className="sensor-reading-meta">
                  <span>Size: {particleSize}</span>
                  <span style={{ color: trendInfo.color }}>{trend.toUpperCase()}</span>
                </div>
              </div>

              {/* Particle bar */}
              <div className="sensor-particle-bar-wrap">
                <div className="sensor-particle-bar-bg">
                  <div
                    className={`sensor-particle-bar-fill fill-${level.cls}`}
                    style={{ width: `${Math.min(100, (particles / 5) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Maintenance */}
              <div className="sensor-maint">
                <div className="sensor-maint-header">
                  <span className="sensor-maint-equip">{maint.equipment}</span>
                  <span className={`sensor-maint-badge ${maint.status === 'OVERDUE' ? 'maint-overdue' : 'maint-ok'}`}>
                    {maint.status === 'OVERDUE' ? `⚠ ${maint.lastServiced - maint.overdueAt}d OVERDUE` : `${maint.lastServiced}d ago`}
                  </span>
                </div>
                <div className="sensor-maint-bar-bg">
                  <div
                    className={`sensor-maint-bar-fill ${maint.status === 'OVERDUE' ? 'maint-bar-overdue' : 'maint-bar-ok'}`}
                    style={{ width: `${Math.min(100, maintPct)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
