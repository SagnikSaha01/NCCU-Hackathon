import React from 'react';

const SCENARIOS = [
  {
    key: 'A',
    name: 'HVAC Filter Failure',
    desc: 'Gradual particle rise from HVAC Unit #7 spreading right via laminar flow',
    color: '#0ea5e9',
    shortDesc: 'HVAC Unit #7 — gradual spread',
  },
  {
    key: 'B',
    name: 'Tool Seal Breach',
    desc: 'Sharp spike localized to Etch Chamber from cracked seal on Dry Etch Tool #3',
    color: '#ef4444',
    shortDesc: 'Etch Chamber — sharp spike',
  },
  {
    key: 'C',
    name: 'Chemical Outgassing',
    desc: 'Slow diffuse spread from Chemical Storage cabinet seal degradation',
    color: '#a855f7',
    shortDesc: 'Chemical Storage — slow diffuse',
  },
];

export default function ScenarioButtons({ activeScenario, onSelect, disabled, horizontal }) {
  if (horizontal) {
    return (
      <div className="scenario-strip-btns">
        {SCENARIOS.map(s => (
          <button
            key={s.key}
            className={`scenario-chip ${activeScenario === s.key ? 'active' : ''}`}
            onClick={() => onSelect(s.key)}
            disabled={disabled}
            style={{
              '--chip-color': s.color,
              borderColor: activeScenario === s.key ? s.color : undefined,
              background: activeScenario === s.key ? `${s.color}22` : undefined,
            }}
          >
            <div
              className="scenario-key"
              style={{
                background: activeScenario === s.key ? s.color : `${s.color}33`,
                color: activeScenario === s.key ? 'white' : s.color,
                width: 22,
                height: 22,
                fontSize: '0.72rem',
              }}
            >
              {s.key}
            </div>
            <div>
              <div className="scenario-chip-name">{s.name}</div>
              <div className="scenario-chip-desc">{s.shortDesc}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="scenario-section">
      <div className="scenario-label">Select Scenario</div>
      {SCENARIOS.map(s => (
        <button
          key={s.key}
          className={`scenario-btn ${activeScenario === s.key ? 'active' : ''}`}
          onClick={() => onSelect(s.key)}
          disabled={disabled}
        >
          <div
            className="scenario-key"
            style={{
              background: activeScenario === s.key ? 'white' : s.color,
              color: activeScenario === s.key ? s.color : 'white',
            }}
          >
            {s.key}
          </div>
          <div className="scenario-info">
            <div className="scenario-name">{s.name}</div>
            <div className="scenario-desc">{s.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
