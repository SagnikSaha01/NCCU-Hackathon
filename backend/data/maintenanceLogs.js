export const maintenanceLogs = {
  'lithography-bay': { lastServiced: 45, overdueAt: 90, equipment: 'Exposure Unit A', status: 'OK' },
  'etch-chamber': { lastServiced: 62, overdueAt: 60, equipment: 'Dry Etch Tool #3', status: 'OVERDUE' },
  'deposition': { lastServiced: 30, overdueAt: 90, equipment: 'CVD Reactor #2', status: 'OK' },
  'cmp': { lastServiced: 55, overdueAt: 90, equipment: 'CMP Polisher', status: 'OK' },
  'metrology': { lastServiced: 10, overdueAt: 90, equipment: 'CD-SEM', status: 'OK' },
  'clean-station': { lastServiced: 20, overdueAt: 60, equipment: 'Wet Bench #4', status: 'OK' },
  'hvac-unit-7': { lastServiced: 94, overdueAt: 90, equipment: 'HEPA Filter Array', status: 'OVERDUE', overdueBy: 4 },
  'chemical-storage': { lastServiced: 78, overdueAt: 90, equipment: 'Chemical Cabinet Seals', status: 'OK' }
};

export const historicalPatterns = {
  HVAC_FILTER_FAILURE: [
    { date: '2024-03-15', source: 'HVAC Unit #3', particleSize: '0.3µm', spread: 'unidirectional-right', duration: '4.2h', signature: 'gradual-ramp' },
    { date: '2024-01-08', source: 'HVAC Unit #5', particleSize: '0.3µm', spread: 'unidirectional-right', duration: '6.1h', signature: 'gradual-ramp' },
    { date: '2023-11-22', source: 'HVAC Unit #7', particleSize: '0.5µm', spread: 'unidirectional-right', duration: '3.8h', signature: 'gradual-ramp' }
  ],
  TOOL_SEAL_BREACH: [
    { date: '2024-02-20', source: 'Etch Chamber #2', particleSize: '1.0µm', spread: 'localized', duration: '0.8h', signature: 'sharp-spike' },
    { date: '2023-12-05', source: 'Etch Chamber #1', particleSize: '0.8µm', spread: 'localized', duration: '1.2h', signature: 'sharp-spike' },
    { date: '2023-09-14', source: 'CVD Reactor #1', particleSize: '1.2µm', spread: 'localized', duration: '0.5h', signature: 'sharp-spike' }
  ],
  CHEMICAL_OUTGASSING: [
    { date: '2024-04-01', source: 'Chemical Storage A', particleSize: '0.1µm', spread: 'diffuse', duration: '12.5h', signature: 'slow-rise' },
    { date: '2023-10-30', source: 'Chemical Storage B', particleSize: '0.1µm', spread: 'diffuse', duration: '9.3h', signature: 'slow-rise' },
    { date: '2023-07-18', source: 'Wet Bench #2', particleSize: '0.2µm', spread: 'diffuse', duration: '8.7h', signature: 'slow-rise' }
  ]
};
