import { historicalPatterns } from '../data/maintenanceLogs.js';

export async function runPatternAgent(scenario, readings, previousOutput) {
  const { spreadPattern, candidateZones } = previousOutput.details;

  // Get dominant particle size from readings
  const particleSizes = Object.values(readings).map(r => r.particleSize);
  const size = particleSizes[0] || '0.3µm';

  // Match based on spread + particle size signature
  let matchedType, confidence, matchedHistory;

  const trends = Object.values(readings).map(r => r.trend);
  const hasSpiking = trends.includes('spiking');
  const hasSlowRise = trends.filter(t => t === 'rising').length >= 2 && !hasSpiking;
  const isLocalized = spreadPattern === 'localized';

  if (hasSpiking && isLocalized) {
    matchedType = 'TOOL_SEAL_BREACH';
    confidence = 91;
    matchedHistory = historicalPatterns.TOOL_SEAL_BREACH;
  } else if (parseFloat(size) <= 0.15) {
    matchedType = 'CHEMICAL_OUTGASSING';
    confidence = 85;
    matchedHistory = historicalPatterns.CHEMICAL_OUTGASSING;
  } else {
    matchedType = 'HVAC_FILTER_FAILURE';
    confidence = 88;
    matchedHistory = historicalPatterns.HVAC_FILTER_FAILURE;
  }

  return {
    agent: 'PatternAgent',
    status: 'complete',
    summary: `Matched contamination signature to ${matchedType} with ${confidence}% pattern confidence. Cross-referenced ${matchedHistory.length} historical events.`,
    details: {
      matchedType,
      patternConfidence: confidence,
      particleSize: size,
      spikeShape: hasSpiking ? 'sharp-spike' : hasSlowRise ? 'slow-rise' : 'gradual-ramp',
      matchedHistoricalEvents: matchedHistory.map(h => ({
        date: h.date,
        source: h.source,
        duration: h.duration,
        signature: h.signature
      })),
      signatureFeatures: {
        spreadType: spreadPattern,
        particleSize: size,
        trend: hasSpiking ? 'spiking' : 'gradual'
      }
    }
  };
}
