import { invokeAgent, extractJSON } from '../services/orchestrateClient.js';

const AGENT_ID = process.env.AGENT_PHYSICS;

export async function runPhysicsAgent(scenario, readings, previousOutput) {
  const { criticalZones = [], elevatedZones = [] } = previousOutput.details;
  const allAffected = [...criticalZones, ...elevatedZones];

  const prompt = `
You are a fluid dynamics expert analyzing contamination in a semiconductor cleanroom.
Airflow moves strictly LEFT TO RIGHT across the fab floor.

FAB FLOOR LAYOUT (4 columns x 2 rows):
Row 1: lithography-bay (col 0), etch-chamber (col 1), deposition (col 2), cmp (col 3)
Row 2: metrology (col 0), clean-station (col 1), hvac-unit-7 (col 2), chemical-storage (col 3)

AFFECTED ZONES FROM SENSOR DATA:
${JSON.stringify(allAffected, null, 2)}

Since airflow moves left to right, contamination spreads from lower columns to higher columns.
Trace upstream to find the source — the affected zone with the LOWEST column number is most likely the origin.

Respond with a JSON object in this exact shape:
{
  "spreadPattern": "localized" or "unidirectional-right",
  "upstreamSource": "zone-id",
  "candidateZones": ["zone-id-1", "zone-id-2"],
  "summary": "one sentence summary"
}
`.trim();

  const raw    = await invokeAgent(AGENT_ID, prompt);
  const parsed = extractJSON(raw);

  return {
    agent: 'PhysicsAgent',
    status: 'complete',
    summary: parsed.summary ?? `Traced source upstream to ${parsed.upstreamSource}. Spread: ${parsed.spreadPattern}.`,
    details: {
      spreadPattern:    parsed.spreadPattern  ?? 'unidirectional-right',
      upstreamSource:   parsed.upstreamSource ?? allAffected[0]?.zone,
      candidateZones:   parsed.candidateZones ?? [],
      flowDirection:    'LEFT_TO_RIGHT',
      airflowVelocity:  '0.45 m/s (ISO Class 5)',
    }
  };
}
