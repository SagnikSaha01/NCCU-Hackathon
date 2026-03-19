// Airflow: LEFT TO RIGHT (col 0 → col 3)
// To trace source: go UPSTREAM (right → left)
export async function runPhysicsAgent(scenario, readings, previousOutput) {
  const { criticalZones, elevatedZones } = previousOutput.details;
  const allAffected = [...criticalZones, ...elevatedZones];

  // Find the leftmost affected zone per row (most upstream = likely source)
  const zoneMap = {
    'lithography-bay': { row: 0, col: 0 },
    'etch-chamber': { row: 0, col: 1 },
    'deposition': { row: 0, col: 2 },
    'cmp': { row: 0, col: 3 },
    'metrology': { row: 1, col: 0 },
    'clean-station': { row: 1, col: 1 },
    'hvac-unit-7': { row: 1, col: 2 },
    'chemical-storage': { row: 1, col: 3 }
  };

  // Sort affected zones by column (upstream = lower col = potential source)
  const withPositions = allAffected
    .filter(z => zoneMap[z.zone])
    .map(z => ({ ...z, ...zoneMap[z.zone] }))
    .sort((a, b) => a.col - b.col);

  // Determine spread pattern first
  const maxCol = Math.max(...withPositions.map(z => z.col));
  const minCol = Math.min(...withPositions.map(z => z.col));
  const spread = maxCol - minCol <= 1 ? 'localized' : 'unidirectional-right';

  // For unidirectional spread: if the highest-particle zone is at the rightmost column,
  // it is likely the source (chemical outgassing or local tool issue at high col).
  // For truly unidirectional flow contamination: highest particle count zone is source.
  const highestParticleZone = [...withPositions].sort((a, b) => b.particles - a.particles)[0];

  // Source heuristic: if highest-reading zone is NOT at the far downstream end,
  // prefer leftmost (most upstream). Otherwise trust the highest reading.
  const leftmostZone = withPositions[0];
  const mostUpstream = (highestParticleZone && highestParticleZone.particles > leftmostZone.particles * 2)
    ? highestParticleZone
    : leftmostZone;

  const candidateZones = [...new Set([mostUpstream.zone, highestParticleZone?.zone])].filter(Boolean).slice(0, 2);

  return {
    agent: 'PhysicsAgent',
    status: 'complete',
    summary: `Traced contamination upstream against laminar flow. Most upstream affected zone: ${mostUpstream?.zone || 'unknown'}. Spread pattern: ${spread}.`,
    details: {
      spreadPattern: spread,
      upstreamSource: mostUpstream?.zone,
      candidateZones,
      flowDirection: 'LEFT_TO_RIGHT',
      airflowVelocity: '0.45 m/s (ISO Class 5)',
      upstreamAnalysis: withPositions.map(z => ({
        zone: z.zone,
        col: z.col,
        particles: z.particles,
        upstreamProbability: `${Math.round((1 - z.col * 0.15) * 100)}%`
      }))
    }
  };
}
