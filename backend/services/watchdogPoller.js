import { runWatchdogAgent } from '../agents/watchdogAgent.js';

const POLL_INTERVAL_MS = 30_000;
const MAX_HISTORY      = 10;

let pollHistory = [];  // most recent first
let pollCount   = 0;

export function getWatchdogState() {
  return {
    polls:        pollHistory,
    latestAlerts: pollHistory[0]?.alerts ?? [],
    pollCount,
    lastPolledAt: pollHistory[0]?.timestamp ?? null,
  };
}

async function poll() {
  const start = Date.now();
  try {
    const result = await runWatchdogAgent();
    const durationMs = Date.now() - start;
    pollCount++;

    const record = {
      pollNumber:       pollCount,
      timestamp:        new Date().toISOString(),
      durationMs,
      alerts:           result.alerts,
      overallRiskLevel: result.overallRiskLevel,
      summary:          result.summary,
      trace:            result.trace ?? null,
      metricsSnapshot:  result.metricsSnapshot,
    };

    pollHistory = [record, ...pollHistory].slice(0, MAX_HISTORY);
    console.log(`[Watchdog] Poll #${pollCount} — ${result.alerts.length} alert(s) — ${durationMs}ms`);
  } catch (err) {
    console.error('[Watchdog] Poll failed:', err.message);
  }
}

export function startWatchdogPoller() {
  poll(); // run immediately on server start
  setInterval(poll, POLL_INTERVAL_MS);
  console.log(`[Watchdog] Poller started — interval ${POLL_INTERVAL_MS / 1000}s`);
}
