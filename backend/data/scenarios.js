export const zones = [
  { id: 'lithography-bay', name: 'Lithography Bay', row: 0, col: 0 },
  { id: 'etch-chamber', name: 'Etch Chamber', row: 0, col: 1 },
  { id: 'deposition', name: 'Deposition', row: 0, col: 2 },
  { id: 'cmp', name: 'CMP', row: 0, col: 3 },
  { id: 'metrology', name: 'Metrology', row: 1, col: 0 },
  { id: 'clean-station', name: 'Clean Station', row: 1, col: 1 },
  { id: 'hvac-unit-7', name: 'HVAC Unit #7', row: 1, col: 2 },
  { id: 'chemical-storage', name: 'Chemical Storage', row: 1, col: 3 }
];

export const scenarios = {
  A: {
    name: 'HVAC Filter Failure',
    type: 'HVAC_FILTER_FAILURE',
    description: 'Gradual particle rise originating from HVAC Unit #7, spreading right via laminar flow',
    readings: {
      'lithography-bay': { particles: 0.07, trend: 'stable', particleSize: '0.3µm' },
      'etch-chamber': { particles: 0.09, trend: 'stable', particleSize: '0.3µm' },
      'deposition': { particles: 0.08, trend: 'stable', particleSize: '0.3µm' },
      'cmp': { particles: 0.06, trend: 'stable', particleSize: '0.3µm' },
      'metrology': { particles: 0.08, trend: 'stable', particleSize: '0.3µm' },
      'clean-station': { particles: 0.09, trend: 'stable', particleSize: '0.3µm' },
      'hvac-unit-7': { particles: 2.85, trend: 'rising', particleSize: '0.3µm' },
      'chemical-storage': { particles: 1.92, trend: 'rising', particleSize: '0.3µm' }
    },
    sourceZone: 'hvac-unit-7',
    confidence: 94
  },
  B: {
    name: 'Tool Seal Breach',
    type: 'TOOL_SEAL_BREACH',
    description: 'Sharp spike localized to Etch Chamber from a cracked seal on Dry Etch Tool #3',
    readings: {
      'lithography-bay': { particles: 0.06, trend: 'stable', particleSize: '0.8µm' },
      'etch-chamber': { particles: 4.71, trend: 'spiking', particleSize: '1.0µm' },
      'deposition': { particles: 0.42, trend: 'slightly-elevated', particleSize: '0.8µm' },
      'cmp': { particles: 0.08, trend: 'stable', particleSize: '0.8µm' },
      'metrology': { particles: 0.07, trend: 'stable', particleSize: '0.8µm' },
      'clean-station': { particles: 0.11, trend: 'stable', particleSize: '0.8µm' },
      'hvac-unit-7': { particles: 0.09, trend: 'stable', particleSize: '0.8µm' },
      'chemical-storage': { particles: 0.07, trend: 'stable', particleSize: '0.8µm' }
    },
    sourceZone: 'etch-chamber',
    confidence: 97
  },
  C: {
    name: 'Chemical Outgassing',
    type: 'CHEMICAL_OUTGASSING',
    description: 'Slow diffuse spread from Chemical Storage cabinet seal degradation',
    readings: {
      'lithography-bay': { particles: 0.08, trend: 'stable', particleSize: '0.1µm' },
      'etch-chamber': { particles: 0.09, trend: 'stable', particleSize: '0.1µm' },
      'deposition': { particles: 0.07, trend: 'stable', particleSize: '0.1µm' },
      'cmp': { particles: 0.06, trend: 'stable', particleSize: '0.1µm' },
      'metrology': { particles: 0.09, trend: 'stable', particleSize: '0.1µm' },
      'clean-station': { particles: 0.31, trend: 'rising', particleSize: '0.1µm' },
      'hvac-unit-7': { particles: 0.44, trend: 'rising', particleSize: '0.1µm' },
      'chemical-storage': { particles: 1.63, trend: 'rising', particleSize: '0.1µm' }
    },
    sourceZone: 'chemical-storage',
    confidence: 88
  }
};

export const baselineReadings = {
  'lithography-bay': 0.07,
  'etch-chamber': 0.09,
  'deposition': 0.08,
  'cmp': 0.06,
  'metrology': 0.08,
  'clean-station': 0.09,
  'hvac-unit-7': 0.07,
  'chemical-storage': 0.06
};
