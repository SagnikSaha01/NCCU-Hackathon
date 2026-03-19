import { invokeAgent, extractJSON } from '../services/orchestrateClient.js';

const AGENT_ID = process.env.AGENT_WATCHDOG;

const MAINTENANCE_SCHEDULE = [
  { zone: 'hvac-unit-7',      equipment: 'HEPA Filter Array',      daysSince: 89, interval: 90 },
  { zone: 'etch-chamber',     equipment: 'Dry Etch Tool #3',       daysSince: 57, interval: 60 },
  { zone: 'chemical-storage', equipment: 'Chemical Cabinet Seals', daysSince: 85, interval: 90 },
  { zone: 'deposition',       equipment: 'CVD Reactor #2',         daysSince: 30, interval: 90 },
  { zone: 'lithography-bay',  equipment: 'Exposure Unit A',        daysSince: 45, interval: 90 },
  { zone: 'cmp',              equipment: 'CMP Polisher',           daysSince: 55, interval: 90 },
  { zone: 'metrology',        equipment: 'CD-SEM',                 daysSince: 10, interval: 90 },
  { zone: 'clean-station',    equipment: 'Wet Bench #4',           daysSince: 20, interval: 60 },
];

const SENSOR_DRIFT = [
  { zone: 'hvac-unit-7',      baseline: 0.07, current: 0.12 },
  { zone: 'etch-chamber',     baseline: 0.09, current: 0.11 },
  { zone: 'chemical-storage', baseline: 0.06, current: 0.09 },
];

const DOWNSTREAM = {
  'hvac-unit-7':      ['chemical-storage'],
  'etch-chamber':     ['deposition', 'cmp'],
  'chemical-storage': [],
  'lithography-bay':  ['etch-chamber', 'deposition', 'cmp'],
  'metrology':        ['clean-station', 'hvac-unit-7', 'chemical-storage'],
};

/**
 * Normalize the WatchdogAgent's output schema to our internal alert shape.
 * Agent returns: risk_level, reason, days_overdue, baseline_drift_pct,
 *   downstream_zones_at_risk, recommended_action, urgency, historical_precedent
 */
function normalizeAlert(a) {
  return {
    zone:               a.zone,
    equipment:          a.equipment ?? equipmentFor(a.zone),
    level:              a.risk_level ?? a.level ?? 'MEDIUM',
    daysOverdue:        a.days_overdue   ?? null,
    driftPercent:       a.baseline_drift_pct ?? a.driftPercent ?? null,
    reason:             a.reason         ?? a.message ?? '',
    recommendedAction:  a.recommended_action ?? '',
    urgency:            a.urgency        ?? 'within 24hrs',
    historicalPrecedent:a.historical_precedent ?? null,
    downstreamZones:    a.downstream_zones_at_risk ?? a.downstreamZones ?? [],
  };
}

function equipmentFor(zone) {
  return MAINTENANCE_SCHEDULE.find(m => m.zone === zone)?.equipment ?? '';
}

function computeLocalAlerts() {
  const alerts = [];

  for (const m of MAINTENANCE_SCHEDULE) {
    const daysOverdue   = m.daysSince - m.interval;
    const overdueRatio  = daysOverdue / m.interval;
    if (overdueRatio < 0.1) continue; // not yet at LOW threshold

    const drift = SENSOR_DRIFT.find(d => d.zone === m.zone);
    const driftPct = drift
      ? Math.round(((drift.current - drift.baseline) / drift.baseline) * 100)
      : 0;

    let level;
    if (overdueRatio >= 0.75)      level = 'CRITICAL';
    else if (overdueRatio >= 0.50) level = 'HIGH';
    else if (overdueRatio >= 0.25) level = 'MEDIUM';
    else                           level = 'LOW';

    // Upgrade if drift is also elevated
    if (driftPct > 50 && level === 'MEDIUM') level = 'HIGH';

    const downstream = DOWNSTREAM[m.zone] ?? [];
    const urgency = level === 'CRITICAL' || level === 'HIGH'
      ? 'immediate'
      : 'within 24hrs';

    alerts.push({
      zone:               m.zone,
      equipment:          m.equipment,
      level,
      daysOverdue:        Math.max(0, daysOverdue),
      driftPercent:       driftPct || null,
      reason:             `${m.equipment} is ${daysOverdue} days overdue for service (interval: ${m.interval} days).${driftPct > 0 ? ` Baseline drift +${driftPct}% detected.` : ''}`,
      recommendedAction:  `Replace/service ${m.equipment} in ${m.zone} — last serviced ${m.daysSince} days ago, interval is ${m.interval} days.`,
      urgency,
      historicalPrecedent: null,
      downstreamZones:    downstream,
    });
  }

  return alerts;
}

export async function runWatchdogAgent() {
  if (!AGENT_ID) {
    console.log('[WatchdogAgent] No AGENT_WATCHDOG in .env — using local computation');
    return {
      alerts: computeLocalAlerts(),
      overallRiskLevel: 'NOMINAL',
      summary: 'Local computation — no Orchestrate agent configured.',
      trace: null,
      metricsSnapshot: { maintenanceSchedule: MAINTENANCE_SCHEDULE, sensorDrift: SENSOR_DRIFT },
    };
  }

  const scheduleText = MAINTENANCE_SCHEDULE
    .map(m => {
      const overdue = m.daysSince - m.interval;
      const status  = overdue > 0 ? `OVERDUE by ${overdue} days` : `${m.interval - m.daysSince} days remaining`;
      return `- ${m.zone}: ${m.equipment}, ${m.daysSince}/${m.interval} days — ${status}`;
    })
    .join('\n');

  const driftText = SENSOR_DRIFT
    .map(d => {
      const pct = Math.round(((d.current - d.baseline) / d.baseline) * 100);
      return `- ${d.zone}: 30-day baseline ${d.baseline} p/m³, current 24h avg ${d.current} p/m³ (+${pct}% drift)`;
    })
    .join('\n');

  const prompt = `
Run your predictive monitoring cycle now.

CURRENT MAINTENANCE STATUS:
${scheduleText}

CURRENT SENSOR BASELINE DRIFT:
${driftText}

FAB LAYOUT (airflow LEFT → RIGHT):
Row 1: lithography-bay → etch-chamber → deposition → cmp
Row 2: metrology → clean-station → hvac-unit-7 → chemical-storage

Analyze all zones and return your JSON risk assessment.
`.trim();

  try {
    const { content, trace } = await invokeAgent(AGENT_ID, prompt);
    const parsed = extractJSON(content);
    const raw = parsed.alerts ?? [];
    return {
      alerts: raw.map(normalizeAlert),
      overallRiskLevel: parsed.overall_fab_risk ?? 'NORMAL',
      summary: parsed.summary ?? '',
      trace,
      metricsSnapshot: { maintenanceSchedule: MAINTENANCE_SCHEDULE, sensorDrift: SENSOR_DRIFT },
    };
  } catch (err) {
    console.error('[WatchdogAgent] Orchestrate call failed, using local computation:', err.message);
    return {
      alerts: computeLocalAlerts(),
      overallRiskLevel: 'NOMINAL',
      summary: 'Local computation — no Orchestrate agent configured.',
      trace: null,
      metricsSnapshot: { maintenanceSchedule: MAINTENANCE_SCHEDULE, sensorDrift: SENSOR_DRIFT },
    };
  }
}
