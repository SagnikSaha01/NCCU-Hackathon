export async function runSeverityAgent(scenario, readings, previousOutput) {
  const { consistencyScore, proposedSource } = previousOutput.details;

  const criticalZones = Object.entries(readings).filter(([, r]) => r.particles > 1.0);
  const elevatedZones = Object.entries(readings).filter(([, r]) => r.particles > 0.3 && r.particles <= 1.0);

  // High-value zones that affect lot quality
  const highValueZones = ['lithography-bay', 'etch-chamber', 'deposition'];
  const affectedHighValue = criticalZones.concat(elevatedZones)
    .filter(([zoneId]) => highValueZones.includes(zoneId));

  const maxParticles = Math.max(...Object.values(readings).map(r => r.particles));

  // Score risk
  let severity, riskScore, lotValueAtRisk;

  if (maxParticles > 3.0 || affectedHighValue.length >= 2) {
    severity = 'CRITICAL';
    riskScore = 92;
    lotValueAtRisk = '$2.4M (estimated 24 wafers in process)';
  } else if (maxParticles > 1.5 || affectedHighValue.length === 1) {
    severity = 'HIGH';
    riskScore = 74;
    lotValueAtRisk = '$850K (estimated 8 wafers at risk)';
  } else if (maxParticles > 0.5) {
    severity = 'MEDIUM';
    riskScore = 45;
    lotValueAtRisk = '$120K (no critical lots at risk)';
  } else {
    severity = 'LOW';
    riskScore = 18;
    lotValueAtRisk = 'Minimal — monitoring recommended';
  }

  return {
    agent: 'SeverityAgent',
    status: 'complete',
    summary: `Risk assessment complete. Severity: ${severity}. Risk score: ${riskScore}/100. ${affectedHighValue.length} high-value production zone(s) affected.`,
    details: {
      severity,
      riskScore,
      lotValueAtRisk,
      criticalZoneCount: criticalZones.length,
      elevatedZoneCount: elevatedZones.length,
      affectedHighValueZones: affectedHighValue.map(([id]) => id),
      maxParticleReading: maxParticles.toFixed(2),
      isoClassViolation: maxParticles > 0.5 ? 'YES — ISO Class 5 threshold exceeded' : 'NO',
      recommendImmediateAction: severity === 'CRITICAL' || severity === 'HIGH'
    }
  };
}
