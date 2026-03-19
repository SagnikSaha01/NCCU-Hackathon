export async function runSensorCoordinator(scenario, readings) {
  const elevated = [];
  const critical = [];

  for (const [zoneId, data] of Object.entries(readings)) {
    if (data.particles > 1.0) {
      critical.push({ zone: zoneId, particles: data.particles, trend: data.trend });
    } else if (data.particles > 0.3) {
      elevated.push({ zone: zoneId, particles: data.particles, trend: data.trend });
    }
  }

  const allAffected = [...critical, ...elevated];
  const particleSizes = [...new Set(Object.values(readings).map(r => r.particleSize))];

  return {
    agent: 'SensorCoordinator',
    status: 'complete',
    summary: `Aggregated ${Object.keys(readings).length} zone sensors. Detected ${critical.length} critical zones and ${elevated.length} elevated zones.`,
    details: {
      criticalZones: critical,
      elevatedZones: elevated,
      totalAffected: allAffected.length,
      particleSizes,
      dominantSize: particleSizes[0],
      alertTime: new Date().toISOString()
    }
  };
}
