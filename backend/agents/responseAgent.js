export async function runResponseAgent(scenario, readings, allOutputs) {
  const sensorOut = allOutputs[0].details;
  const physicsOut = allOutputs[1].details;
  const patternOut = allOutputs[2].details;
  const correlationOut = allOutputs[3].details;
  const verificationOut = allOutputs[4].details;
  const severityOut = allOutputs[5].details;

  const source = verificationOut.proposedSource;
  const matchedType = patternOut.matchedType;
  const severity = severityOut.severity;
  const confidence = Math.round((patternOut.patternConfidence + verificationOut.consistencyScore) / 2);

  const actionsByType = {
    HVAC_FILTER_FAILURE: [
      { priority: 1, action: 'Immediately inspect HVAC Unit #7 HEPA filter array', urgency: 'IMMEDIATE', owner: 'Facilities Engineer', estTime: '15 min' },
      { priority: 2, action: 'Halt wafer processing in Chemical Storage and HVAC-adjacent zones', urgency: 'IMMEDIATE', owner: 'Process Engineer', estTime: '5 min' },
      { priority: 3, action: 'Activate backup HVAC circuit B to restore cleanroom pressure balance', urgency: 'URGENT', owner: 'Facilities Engineer', estTime: '20 min' },
      { priority: 4, action: 'Replace HEPA filter array in HVAC Unit #7 (filter 94-day overdue)', urgency: 'URGENT', owner: 'Maintenance Crew', estTime: '2 hours' },
      { priority: 5, action: 'Full cleanroom particle sweep — all zones', urgency: 'ROUTINE', owner: 'QA Team', estTime: '3 hours' },
      { priority: 6, action: 'Quarantine and inspect wafer lots processed in last 2 hours', urgency: 'ROUTINE', owner: 'QA Engineer', estTime: '4 hours' }
    ],
    TOOL_SEAL_BREACH: [
      { priority: 1, action: 'Emergency shutdown of Dry Etch Tool #3 in Etch Chamber', urgency: 'IMMEDIATE', owner: 'Tool Engineer', estTime: '2 min' },
      { priority: 2, action: 'Evacuate and seal Etch Chamber — initiate nitrogen purge', urgency: 'IMMEDIATE', owner: 'Facilities Engineer', estTime: '10 min' },
      { priority: 3, action: 'Inspect O-ring seal and chamber lid gasket on Etch Tool #3', urgency: 'URGENT', owner: 'Tool Engineer', estTime: '30 min' },
      { priority: 4, action: 'Replace all chamber seals (last replaced 62 days ago — overdue by 2 days)', urgency: 'URGENT', owner: 'Maintenance Crew', estTime: '4 hours' },
      { priority: 5, action: 'Quarantine wafers processed in Etch Chamber in last 90 min', urgency: 'ROUTINE', owner: 'QA Engineer', estTime: '2 hours' },
      { priority: 6, action: 'Particle count verification sweep before tool restart', urgency: 'ROUTINE', owner: 'QA Team', estTime: '1 hour' }
    ],
    CHEMICAL_OUTGASSING: [
      { priority: 1, action: 'Seal Chemical Storage cabinet and increase local exhaust ventilation', urgency: 'IMMEDIATE', owner: 'Safety Officer', estTime: '5 min' },
      { priority: 2, action: 'Identify outgassing chemical source — inspect cabinet seals and containers', urgency: 'IMMEDIATE', owner: 'Chemical Engineer', estTime: '20 min' },
      { priority: 3, action: 'Remove personnel from Chemical Storage zone — potential VOC exposure', urgency: 'URGENT', owner: 'Safety Officer', estTime: '5 min' },
      { priority: 4, action: 'Contact chemical supplier for compatibility report — suspected seal degradation', urgency: 'URGENT', owner: 'Procurement', estTime: '1 hour' },
      { priority: 5, action: 'Replace cabinet seals and re-certify chemical storage containers', urgency: 'ROUTINE', owner: 'Maintenance Crew', estTime: '3 hours' },
      { priority: 6, action: 'Air quality monitoring for 24h post-remediation', urgency: 'ROUTINE', owner: 'EHS Team', estTime: '24 hours' }
    ]
  };

  const actions = actionsByType[matchedType] || actionsByType.HVAC_FILTER_FAILURE;

  return {
    agent: 'ResponseAgent',
    status: 'complete',
    summary: `Response plan generated for ${matchedType} at ${source}. ${actions.filter(a => a.urgency === 'IMMEDIATE').length} immediate actions, ${actions.filter(a => a.urgency === 'URGENT').length} urgent actions. AWAITING ENGINEER APPROVAL.`,
    details: {
      diagnosis: {
        source,
        type: matchedType,
        severity,
        confidence,
        maintenanceLink: correlationOut.maintenanceFingerprint
      },
      recommendedActions: actions,
      disclaimer: 'RECOMMENDATIONS ONLY — Awaiting authorized engineer approval before execution',
      approvalRequired: true,
      estimatedRemediationTime: '2-4 hours',
      generatedAt: new Date().toISOString(),
      investigationTime: '2 min 17 sec'
    }
  };
}
