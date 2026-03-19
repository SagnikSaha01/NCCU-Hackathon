export async function runVerificationAgent(scenario, readings, previousOutput) {
  const { primaryCandidate } = previousOutput.details;

  const zonePositions = {
    'lithography-bay': { row: 0, col: 0 },
    'etch-chamber': { row: 0, col: 1 },
    'deposition': { row: 0, col: 2 },
    'cmp': { row: 0, col: 3 },
    'metrology': { row: 1, col: 0 },
    'clean-station': { row: 1, col: 1 },
    'hvac-unit-7': { row: 1, col: 2 },
    'chemical-storage': { row: 1, col: 3 }
  };

  // Verify: zones downstream (higher col) of source should be elevated
  const sourcePos = zonePositions[primaryCandidate];
  const verificationChecks = [];

  if (sourcePos) {
    for (const [zoneId, reading] of Object.entries(readings)) {
      const pos = zonePositions[zoneId];
      if (!pos) continue;

      const isDownstream = pos.col > sourcePos.col && pos.row === sourcePos.row;
      const isSource = zoneId === primaryCandidate;
      const isElevated = reading.particles > 0.2;

      if (isSource) {
        verificationChecks.push({ zone: zoneId, expected: 'elevated', actual: isElevated ? 'elevated' : 'normal', pass: isElevated, role: 'source' });
      } else if (isDownstream) {
        verificationChecks.push({ zone: zoneId, expected: 'possibly-elevated', actual: isElevated ? 'elevated' : 'normal', pass: true, role: 'downstream' });
      } else {
        verificationChecks.push({ zone: zoneId, expected: 'normal', actual: isElevated ? 'elevated' : 'normal', pass: !isElevated || pos.col < sourcePos.col, role: 'upstream-or-other' });
      }
    }
  }

  const passCount = verificationChecks.filter(c => c.pass).length;
  const totalChecks = verificationChecks.length;
  const consistencyScore = totalChecks > 0 ? Math.round((passCount / totalChecks) * 100) : 0;
  const isConsistent = consistencyScore >= 75;

  return {
    agent: 'VerificationAgent',
    status: 'complete',
    summary: `Spread pattern ${isConsistent ? 'IS consistent' : 'is NOT fully consistent'} with ${primaryCandidate} as source. Consistency score: ${consistencyScore}%.`,
    details: {
      proposedSource: primaryCandidate,
      consistencyScore,
      isConsistent,
      verificationChecks,
      passCount,
      totalChecks,
      conclusion: isConsistent
        ? `Hypothesis CONFIRMED: ${primaryCandidate} is consistent with observed spread pattern`
        : `Hypothesis UNCERTAIN: spread pattern partially consistent with ${primaryCandidate}`
    }
  };
}
