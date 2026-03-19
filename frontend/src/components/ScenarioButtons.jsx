import React from 'react';

const SCENARIOS = [
  {
    key: 'A',
    name: 'HVAC Filter Failure',
    desc: 'Gradual particle rise from HVAC Unit #7 spreading right via laminar flow',
    color: '#0ea5e9',
  },
  {
    key: 'B',
    name: 'Tool Seal Breach',
    desc: 'Sharp spike localized to Etch Chamber from cracked seal on Dry Etch Tool #3',
    color: '#ef4444',
  },
  {
    key: 'C',
    name: 'Chemical Outgassing',
    desc: 'Slow diffuse spread from Chemical Storage cabinet seal degradation',
    color: '#a855f7',
  },
];

export default function ScenarioButtons({ activeScenario, onSelect, disabled }) {
  return (
    <div className="scenario-section">
      <div className="scenario-label">Select Scenario</div>
      {SCENARIOS.map(s => (
        <button
          key={s.key}
          className={`scenario-btn ${activeScenario === s.key ? 'active' : ''}`}
          onClick={() => onSelect(s.key)}
          disabled={disabled}
          style={activeScenario === s.key ? { '--key-bg': s.color } : {}}
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
