import { invokeAgent, extractJSON } from '../services/orchestrateClient.js';

const AGENT_ID = process.env.AGENT_SEVERITY;

export async function runSeverityAgent(scenario, readings, previousOutput) {
  const { consistencyScore, proposedSource } = previousOutput.details;

  const maxParticles = Math.max(...Object.values(readings).map(r => r.particles));
  const readingsSummary = Object.entries(readings)
    .map(([zone, r]) => `${zone}: ${r.particles} p/m³`)
    .join('\n');

  const prompt = `
You are a risk assessment specialist for a semiconductor cleanroom.

VERIFIED SOURCE ZONE: ${proposedSource}
VERIFICATION CONSISTENCY SCORE: ${consistencyScore}%
MAX PARTICLE READING: ${maxParticles.toFixed(2)} p/m³

ALL ZONE READINGS:
${readingsSummary}

HIGH VALUE PRODUCTION ZONES (wafer lots at risk): lithography-bay, etch-chamber, deposition

Assign severity using these rules:
- CRITICAL: max reading >3.0 p/m³ OR 2+ high-value zones affected → lot value at risk ~$2.4M
- HIGH: max reading >1.5 p/m³ OR 1 high-value zone affected → lot value at risk ~$850K
- MEDIUM: max reading >0.5 p/m³, no high-value zones → lot value at risk ~$120K
- LOW: max reading <0.5 p/m³ → minimal risk

ISO Class 5 threshold: 0.5 p/m³. Above this is a violation.

Respond with a JSON object in this exact shape:
{
  "severity": "CRITICAL" or "HIGH" or "MEDIUM" or "LOW",
  "riskScore": 0-100,
  "lotValueAtRisk": "dollar amount string",
  "isoClassViolation": "YES — ISO Class 5 threshold exceeded" or "NO",
  "recommendImmediateAction": true or false,
  "summary": "one sentence summary"
}
`.trim();

  const { content, trace } = await invokeAgent(AGENT_ID, prompt);
  const parsed = extractJSON(content);

  const severity  = parsed.severity  ?? 'HIGH';
  const riskScore = parsed.riskScore ?? 70;

  return {
    agent: 'SeverityAgent',
    status: 'complete',
    summary: parsed.summary ?? `Severity: ${severity}. Risk score: ${riskScore}/100.`,
    trace,
    details: {
      severity,
      riskScore,
      lotValueAtRisk:           parsed.lotValueAtRisk           ?? 'Unknown',
      isoClassViolation:        parsed.isoClassViolation        ?? 'NO',
      recommendImmediateAction: parsed.recommendImmediateAction ?? false,
      maxParticleReading:       maxParticles.toFixed(2),
    }
  };
}
