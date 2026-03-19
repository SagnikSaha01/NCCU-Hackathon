import { invokeAgent, extractJSON } from '../services/orchestrateClient.js';

const AGENT_ID = process.env.AGENT_VERIFICATION;

export async function runVerificationAgent(scenario, readings, previousOutput) {
  const { primaryCandidate } = previousOutput.details;

  const readingsSummary = Object.entries(readings)
    .map(([zone, r]) => `${zone}: ${r.particles} p/m³ (${r.trend})`)
    .join('\n');

  const prompt = `
You are a forensic validator for semiconductor cleanroom contamination investigations.

PROPOSED SOURCE ZONE: ${primaryCandidate}

FAB FLOOR LAYOUT (airflow moves LEFT TO RIGHT, col 0 → col 3):
Row 1: lithography-bay (col 0), etch-chamber (col 1), deposition (col 2), cmp (col 3)
Row 2: metrology (col 0), clean-station (col 1), hvac-unit-7 (col 2), chemical-storage (col 3)

CURRENT ZONE READINGS:
${readingsSummary}

Verify the hypothesis using these rules:
- The proposed source zone should itself be elevated or critical
- Zones DOWNSTREAM (higher col, same row) may also be elevated — this is expected and consistent
- Zones UPSTREAM (lower col) of the source should be normal — if elevated, the hypothesis weakens
- Zones in the other row should generally be unaffected

Calculate a consistency score 0-100 based on how well the readings match what physics predicts.

Respond with a JSON object in this exact shape:
{
  "proposedSource": "zone-id",
  "consistencyScore": 0-100,
  "isConsistent": true or false,
  "conclusion": "one sentence conclusion",
  "summary": "one sentence summary"
}
`.trim();

  const { content, trace } = await invokeAgent(AGENT_ID, prompt);
  const parsed = extractJSON(content);

  const consistencyScore = parsed.consistencyScore ?? 75;
  const isConsistent     = parsed.isConsistent     ?? true;

  return {
    agent: 'VerificationAgent',
    status: 'complete',
    summary: parsed.summary ?? `Consistency score: ${consistencyScore}%. Hypothesis ${isConsistent ? 'CONFIRMED' : 'UNCERTAIN'}.`,
    trace,
    details: {
      proposedSource:   parsed.proposedSource ?? primaryCandidate,
      consistencyScore,
      isConsistent,
      conclusion:       parsed.conclusion     ?? '',
    }
  };
}
