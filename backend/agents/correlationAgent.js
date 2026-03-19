import { invokeAgent, extractJSON } from '../services/orchestrateClient.js';

const AGENT_ID = process.env.AGENT_CORRELATION;

const MAINTENANCE_LOG = `
- lithography-bay: Exposure Unit A, last serviced 45 days ago, due every 90 days — OK
- etch-chamber: Dry Etch Tool #3, last serviced 62 days ago, due every 60 days — OVERDUE by 2 days
- deposition: CVD Reactor #2, last serviced 30 days ago, due every 90 days — OK
- cmp: CMP Polisher, last serviced 55 days ago, due every 90 days — OK
- metrology: CD-SEM, last serviced 10 days ago, due every 90 days — OK
- clean-station: Wet Bench #4, last serviced 20 days ago, due every 60 days — OK
- hvac-unit-7: HEPA Filter Array, last serviced 94 days ago, due every 90 days — OVERDUE by 4 days
- chemical-storage: Chemical Cabinet Seals, last serviced 78 days ago, due every 90 days — OK
`.trim();

export async function runCorrelationAgent(scenario, readings, previousOutput) {
  const { candidateZones = [], matchedType } = previousOutput.details;

  const prompt = `
You are a maintenance records analyst for a semiconductor cleanroom.

CANDIDATE SOURCE ZONES (from physics analysis): ${candidateZones.join(', ')}
CONTAMINATION TYPE (from pattern analysis): ${matchedType}

FULL MAINTENANCE LOG:
${MAINTENANCE_LOG}

Check the maintenance log for the candidate zones only.
Identify if any have overdue equipment — overdue maintenance strongly corroborates the contamination hypothesis.
The zone with the most overdue equipment should be your primary candidate.

Respond with a JSON object in this exact shape:
{
  "primaryCandidate": "zone-id",
  "overdueCount": 0,
  "maintenanceFingerprint": "description of overdue equipment",
  "correlations": [
    {"zone": "zone-id", "status": "OVERDUE" or "OK", "overdueBy": 0, "maintenanceCorrelation": "HIGH" or "LOW"}
  ],
  "summary": "one sentence summary"
}
`.trim();

  const raw    = await invokeAgent(AGENT_ID, prompt);
  const parsed = extractJSON(raw);

  return {
    agent: 'CorrelationAgent',
    status: 'complete',
    summary: parsed.summary ?? `Primary candidate: ${parsed.primaryCandidate}. Overdue items: ${parsed.overdueCount}.`,
    details: {
      primaryCandidate:      parsed.primaryCandidate      ?? candidateZones[0],
      overdueCount:          parsed.overdueCount          ?? 0,
      maintenanceFingerprint:parsed.maintenanceFingerprint ?? '',
      maintenanceCorrelations: parsed.correlations        ?? [],
      logCheckedAt:          new Date().toISOString(),
    }
  };
}
