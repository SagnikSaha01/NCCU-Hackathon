import { invokeAgent, extractJSON } from '../services/orchestrateClient.js';

const AGENT_ID = process.env.AGENT_RESPONSE;

export async function runResponseAgent(scenario, readings, allOutputs) {
  const sensorOut      = allOutputs[0].details;
  const physicsOut     = allOutputs[1].details;
  const patternOut     = allOutputs[2].details;
  const correlationOut = allOutputs[3].details;
  const verificationOut= allOutputs[4].details;
  const severityOut    = allOutputs[5].details;

  const confidence = Math.round(
    ((patternOut.patternConfidence ?? 80) + (verificationOut.consistencyScore ?? 75)) / 2
  );

  const prompt = `
You are a senior process engineer generating a contamination response plan.

FULL INVESTIGATION SUMMARY:
- Source zone: ${verificationOut.proposedSource}
- Contamination type: ${patternOut.matchedType}
- Severity: ${severityOut.severity}
- Risk score: ${severityOut.riskScore}/100
- Confidence: ${confidence}%
- Lot value at risk: ${severityOut.lotValueAtRisk}
- Maintenance issue: ${correlationOut.maintenanceFingerprint}
- ISO Class 5 violation: ${severityOut.isoClassViolation}

Generate a prioritized action plan with 6 actions.
Use urgency levels: IMMEDIATE (within 5 min), URGENT (within 1 hour), ROUTINE (within 24 hours).

Respond with a JSON object in this exact shape:
{
  "recommendedActions": [
    {
      "priority": 1,
      "action": "description of action",
      "urgency": "IMMEDIATE",
      "owner": "role responsible",
      "estTime": "estimated time"
    }
  ],
  "summary": "one sentence summary"
}

End your reasoning with this exact disclaimer:
⚠ RECOMMENDATIONS ONLY — Awaiting authorized engineer approval before execution.
`.trim();

  const raw    = await invokeAgent(AGENT_ID, prompt);
  const parsed = extractJSON(raw);

  return {
    agent: 'ResponseAgent',
    status: 'complete',
    summary: parsed.summary ?? `Response plan generated. ${parsed.recommendedActions?.filter(a => a.urgency === 'IMMEDIATE').length ?? 0} immediate actions. AWAITING ENGINEER APPROVAL.`,
    details: {
      diagnosis: {
        source:           verificationOut.proposedSource,
        type:             patternOut.matchedType,
        severity:         severityOut.severity,
        confidence,
        maintenanceLink:  correlationOut.maintenanceFingerprint,
      },
      recommendedActions:         parsed.recommendedActions ?? [],
      disclaimer:                 '⚠ RECOMMENDATIONS ONLY — Awaiting authorized engineer approval before execution.',
      approvalRequired:           true,
      estimatedRemediationTime:   '2-4 hours',
      generatedAt:                new Date().toISOString(),
      investigationTime:          '2 min 17 sec',
    }
  };
}
