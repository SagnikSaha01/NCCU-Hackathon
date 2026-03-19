import { invokeAgent, extractJSON } from '../services/orchestrateClient.js';

const AGENT_ID = process.env.AGENT_PATTERN;

export async function runPatternAgent(scenario, readings, previousOutput) {
  const { spreadPattern, candidateZones } = previousOutput.details;

  const particleSizes = [...new Set(Object.values(readings).map(r => r.particleSize))];
  const trends        = Object.values(readings).map(r => r.trend);

  const prompt = `
You are a contamination pattern recognition expert for semiconductor cleanrooms.

FINDINGS FROM PHYSICS AGENT:
- Spread pattern: ${spreadPattern}
- Candidate source zones: ${candidateZones?.join(', ')}

SENSOR SIGNATURE:
- Particle sizes detected: ${particleSizes.join(', ')}
- Trends across zones: ${trends.join(', ')}

Match the contamination event to one of these three types:

HVAC_FILTER_FAILURE: particle size ~0.3µm, unidirectional spread, gradual ramp-up trend
TOOL_SEAL_BREACH: particle size 0.8-1.0µm, localized spread, sharp sudden spike
CHEMICAL_OUTGASSING: particle size 0.1-0.2µm, diffuse spread, slow gradual rise

Historical reference:
- HVAC failures typically last 4-6 hours
- Tool seal breaches typically last 0.5-1.5 hours
- Chemical outgassing typically lasts 8-12 hours

Respond with a JSON object in this exact shape:
{
  "matchedType": "HVAC_FILTER_FAILURE" or "TOOL_SEAL_BREACH" or "CHEMICAL_OUTGASSING",
  "patternConfidence": 0-100,
  "spikeShape": "gradual-ramp" or "sharp-spike" or "slow-rise",
  "summary": "one sentence summary"
}
`.trim();

  const { content, trace } = await invokeAgent(AGENT_ID, prompt);
  const parsed = extractJSON(content);

  return {
    agent: 'PatternAgent',
    status: 'complete',
    summary: parsed.summary ?? `Matched to ${parsed.matchedType ?? 'HVAC_FILTER_FAILURE'} with ${parsed.patternConfidence ?? 80}% confidence.`,
    trace,
    details: {
      matchedType:       parsed.matchedType       ?? 'HVAC_FILTER_FAILURE',
      patternConfidence: parsed.patternConfidence  ?? 80,
      particleSize:      particleSizes[0]          ?? '0.3µm',
      spikeShape:        parsed.spikeShape         ?? 'gradual-ramp',
      signatureFeatures: {
        spreadType:   spreadPattern,
        particleSize: particleSizes[0],
        trend:        trends.includes('spiking') ? 'spiking' : 'gradual',
      }
    }
  };
}
