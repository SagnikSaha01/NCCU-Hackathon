import { invokeAgent, extractJSON } from '../services/orchestrateClient.js';

const AGENT_ID = process.env.AGENT_SENSOR_COORDINATOR;

export async function runSensorCoordinator(scenario, readings) {
  const readingsSummary = Object.entries(readings)
    .map(([zone, r]) => `${zone}: ${r.particles} p/m³ (trend: ${r.trend}, size: ${r.particleSize})`)
    .join('\n');

  const prompt = `
You are receiving live particle sensor readings from 8 cleanroom zones.

READINGS:
${readingsSummary}

Classify each zone as NORMAL (<0.3), ELEVATED (0.3-1.0), or CRITICAL (>1.0) p/m³.
Identify all affected zones, the highest reading, and dominant particle size.

Respond with a JSON object in this exact shape:
{
  "criticalZones": [{"zone": "zone-id", "particles": 0.0, "trend": "..."}],
  "elevatedZones": [{"zone": "zone-id", "particles": 0.0, "trend": "..."}],
  "totalAffected": 0,
  "dominantSize": "0.3µm",
  "summary": "one sentence summary"
}
`.trim();

  const raw    = await invokeAgent(AGENT_ID, prompt);
  console.log('\n[SensorCoordinator] RAW RESPONSE FROM ORCHESTRATE:\n', raw, '\n');
  const parsed = extractJSON(raw);
  console.log('[SensorCoordinator] PARSED:', JSON.stringify(parsed, null, 2));

  return {
    agent: 'SensorCoordinator',
    status: 'complete',
    summary: parsed.summary ?? `Detected ${parsed.criticalZones?.length ?? 0} critical and ${parsed.elevatedZones?.length ?? 0} elevated zones.`,
    details: {
      criticalZones: parsed.criticalZones ?? [],
      elevatedZones: parsed.elevatedZones ?? [],
      totalAffected: parsed.totalAffected ?? 0,
      particleSizes: [parsed.dominantSize ?? '0.3µm'],
      dominantSize:  parsed.dominantSize  ?? '0.3µm',
      alertTime:     new Date().toISOString(),
    }
  };
}
