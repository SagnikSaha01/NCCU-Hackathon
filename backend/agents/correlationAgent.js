import { maintenanceLogs } from '../data/maintenanceLogs.js';

export async function runCorrelationAgent(scenario, readings, previousOutput) {
  const { candidateZones } = previousOutput.details;
  const { matchedType } = previousOutput.details;

  // Check maintenance logs for candidate zones
  const correlations = (candidateZones || []).map(zoneId => {
    const log = maintenanceLogs[zoneId];
    if (!log) return null;
    const isOverdue = log.status === 'OVERDUE';
    const overdueBy = log.lastServiced - log.overdueAt;
    return {
      zone: zoneId,
      equipment: log.equipment,
      lastServiced: log.lastServiced,
      overdueAt: log.overdueAt,
      status: log.status,
      overdueBy: isOverdue ? overdueBy : 0,
      maintenanceCorrelation: isOverdue ? 'HIGH' : 'LOW',
      note: isOverdue
        ? `${log.equipment} is ${overdueBy} days overdue for service`
        : `${log.equipment} serviced ${log.lastServiced} days ago — within schedule`
    };
  }).filter(Boolean);

  const overdueZones = correlations.filter(c => c.status === 'OVERDUE');
  const primaryCandidate = overdueZones[0] || correlations[0];

  return {
    agent: 'CorrelationAgent',
    status: 'complete',
    summary: `Checked maintenance logs for ${correlations.length} candidate zones. Found ${overdueZones.length} overdue maintenance item(s). Primary candidate: ${primaryCandidate?.zone || 'unknown'}.`,
    details: {
      maintenanceCorrelations: correlations,
      overdueCount: overdueZones.length,
      primaryCandidate: primaryCandidate?.zone,
      maintenanceFingerprint: primaryCandidate?.note,
      logCheckedAt: new Date().toISOString()
    }
  };
}
