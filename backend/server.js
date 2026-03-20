import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { scenarios, zones } from './data/scenarios.js';
import { runSensorCoordinator } from './agents/sensorCoordinator.js';
import { runPhysicsAgent } from './agents/physicsAgent.js';
import { runPatternAgent } from './agents/patternAgent.js';
import { runCorrelationAgent } from './agents/correlationAgent.js';
import { runVerificationAgent } from './agents/verificationAgent.js';
import { runSeverityAgent } from './agents/severityAgent.js';
import { runResponseAgent } from './agents/responseAgent.js';
import { startWatchdogPoller, getWatchdogState } from './services/watchdogPoller.js';
import { startSerialBridge } from './services/serialBridge.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/zones', (req, res) => {
  res.json(zones);
});

app.get('/api/scenarios', (req, res) => {
  res.json(Object.entries(scenarios).map(([key, s]) => ({
    key,
    name: s.name,
    type: s.type,
    description: s.description
  })));
});

// SSE endpoint for real-time agent feed
app.get('/api/investigate/:scenarioKey', async (req, res) => {
  const { scenarioKey } = req.params;
  const scenario = scenarios[scenarioKey];

  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial sensor readings
  send({ type: 'SCENARIO_START', scenario: scenarioKey, readings: scenario.readings, scenarioName: scenario.name });

  const agentOutputs = [];
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // Agent 1: SensorCoordinator
    send({ type: 'AGENT_START', agent: 'SensorCoordinator', message: 'Aggregating all 8 zone sensor readings...' });
    await delay(1500);
    const sensorResult = await runSensorCoordinator(scenario, scenario.readings);
    agentOutputs.push(sensorResult);
    send({ type: 'AGENT_COMPLETE', ...sensorResult });
    await delay(1200);

    // Agent 2: PhysicsAgent
    send({ type: 'AGENT_START', agent: 'PhysicsAgent', message: 'Tracing contamination upstream against laminar airflow...' });
    await delay(1800);
    const physicsResult = await runPhysicsAgent(scenario, scenario.readings, sensorResult);
    agentOutputs.push(physicsResult);
    send({ type: 'AGENT_COMPLETE', ...physicsResult });
    await delay(1200);

    // Agent 3: PatternAgent
    send({ type: 'AGENT_START', agent: 'PatternAgent', message: 'Matching contamination signature to historical event database...' });
    await delay(2000);
    const patternResult = await runPatternAgent(scenario, scenario.readings, physicsResult);
    agentOutputs.push(patternResult);
    send({ type: 'AGENT_COMPLETE', ...patternResult });
    await delay(1200);

    // Agent 4: CorrelationAgent (needs candidate zones from physics + type from pattern)
    const correlationInput = {
      details: {
        candidateZones: physicsResult.details.candidateZones,
        matchedType: patternResult.details.matchedType
      }
    };
    send({ type: 'AGENT_START', agent: 'CorrelationAgent', message: 'Checking equipment maintenance logs for candidate zones...' });
    await delay(1600);
    const correlationResult = await runCorrelationAgent(scenario, scenario.readings, correlationInput);
    agentOutputs.push(correlationResult);
    send({ type: 'AGENT_COMPLETE', ...correlationResult });
    await delay(1200);

    // Agent 5: VerificationAgent
    send({ type: 'AGENT_START', agent: 'VerificationAgent', message: 'Cross-validating spread pattern consistency with proposed source...' });
    await delay(1700);
    const verificationResult = await runVerificationAgent(scenario, scenario.readings, correlationResult);
    agentOutputs.push(verificationResult);
    send({ type: 'AGENT_COMPLETE', ...verificationResult });
    await delay(1200);

    // Agent 6: SeverityAgent
    send({ type: 'AGENT_START', agent: 'SeverityAgent', message: 'Calculating risk score and lot value at risk...' });
    await delay(1400);
    const severityResult = await runSeverityAgent(scenario, scenario.readings, verificationResult);
    agentOutputs.push(severityResult);
    send({ type: 'AGENT_COMPLETE', ...severityResult });
    await delay(1200);

    // Agent 7: ResponseAgent
    send({ type: 'AGENT_START', agent: 'ResponseAgent', message: 'Generating prioritized response plan for engineer approval...' });
    await delay(2200);
    const responseResult = await runResponseAgent(scenario, scenario.readings, agentOutputs);
    agentOutputs.push(responseResult);
    send({ type: 'AGENT_COMPLETE', ...responseResult });

    send({ type: 'INVESTIGATION_COMPLETE', totalTime: '2 min 17 sec' });
  } catch (err) {
    send({ type: 'ERROR', message: err.message });
  }

  res.end();
});

app.get('/api/watchdog/alerts', (_req, res) => {
  res.json(getWatchdogState());
});

// ── Demo: mock SSE investigation for the Arduino physical demo tab ────────────
// Pre-scripted HVAC Scenario A outputs — no real agent calls, ~20s total.
const DEMO_MOCK_STEPS = [
  {
    delay: 2000,
    start: { agent: 'SensorCoordinator', message: 'Aggregating all 8 zone sensor readings...' },
    complete: {
      agent: 'SensorCoordinator',
      summary: 'Detected 2 critical zones: hvac-unit-7 (2.85 p/m³), chemical-storage (1.92 p/m³). 6 zones nominal.',
      details: { criticalZones: ['hvac-unit-7'], elevatedZones: ['chemical-storage'], totalAffected: 2, dominantSize: '0.3µm' },
    },
  },
  {
    delay: 3000,
    start: { agent: 'PhysicsAgent', message: 'Tracing contamination upstream against laminar airflow (0.45 m/s)...' },
    complete: {
      agent: 'PhysicsAgent',
      summary: 'Traced source upstream to hvac-unit-7 (Col 2, Row 1). Spread: unidirectional-right via laminar flow.',
      details: { upstreamSource: 'hvac-unit-7', spreadPattern: 'unidirectional-right', candidateZones: ['hvac-unit-7', 'chemical-storage'] },
    },
  },
  {
    delay: 3000,
    start: { agent: 'PatternAgent', message: 'Matching contamination signature to historical event database...' },
    complete: {
      agent: 'PatternAgent',
      summary: 'Matched HVAC_FILTER_FAILURE with 94% confidence. Gradual ramp-up signature, 0.3µm particles. 3 historical precedents.',
      details: { matchedType: 'HVAC_FILTER_FAILURE', patternConfidence: 94, spikeShape: 'gradual-ramp' },
    },
  },
  {
    delay: 3000,
    start: { agent: 'CorrelationAgent', message: 'Checking equipment maintenance logs for candidate zones...' },
    complete: {
      agent: 'CorrelationAgent',
      summary: 'HVAC Unit #7 filter overdue by 4 days (last serviced 94 days ago, interval 90 days). Primary candidate confirmed.',
      details: { primaryCandidate: 'hvac-unit-7', overdueCount: 1, maintenanceFingerprint: 'HVAC filter — 4 days overdue' },
    },
  },
  {
    delay: 3000,
    start: { agent: 'VerificationAgent', message: 'Cross-validating spread pattern consistency with proposed source...' },
    complete: {
      agent: 'VerificationAgent',
      summary: 'Consistency score: 96%. Downstream zone (chemical-storage) elevated as expected. Hypothesis CONFIRMED.',
      details: { proposedSource: 'hvac-unit-7', consistencyScore: 96, isConsistent: true },
    },
  },
  {
    delay: 3000,
    start: { agent: 'SeverityAgent', message: 'Calculating risk score and lot value at risk...' },
    complete: {
      agent: 'SeverityAgent',
      summary: 'Severity: CRITICAL. Risk score: 87/100. Lot value at risk: ~$2.4M. ISO Class 5 violation confirmed.',
      details: { severity: 'CRITICAL', riskScore: 87, lotValueAtRisk: '~$2.4M', isoClassViolation: 'YES — 2.85 p/m³ exceeds 0.5 p/m³ threshold' },
    },
  },
  {
    delay: 3000,
    start: { agent: 'ResponseAgent', message: 'Generating prioritized remediation plan for engineer approval...' },
    complete: {
      agent: 'ResponseAgent',
      summary: '6 immediate actions generated. Source: HVAC Unit #7. Recommend immediate shutdown of HVAC unit. AWAITING ENGINEER APPROVAL.',
      details: {
        diagnosis: {
          source: 'hvac-unit-7',
          type: 'HVAC_FILTER_FAILURE',
          confidence: 94,
          maintenanceLink: 'HVAC filter overdue by 4 days — last serviced 94 days ago',
        },
        recommendedActions: [
          { priority: 1, action: 'Immediately shut down HVAC Unit #7 to halt contamination spread', urgency: 'IMMEDIATE', owner: 'Facilities Engineer', estTime: '5 min' },
          { priority: 2, action: 'Isolate affected zones (hvac-unit-7, chemical-storage) and halt wafer processing', urgency: 'IMMEDIATE', owner: 'Fab Operator', estTime: '10 min' },
          { priority: 3, action: 'Inspect and replace HVAC Unit #7 filter (94-day accumulation)', urgency: 'URGENT', owner: 'Maintenance Tech', estTime: '45 min' },
          { priority: 4, action: 'Deploy portable HEPA scrubbers in affected zones during HVAC downtime', urgency: 'URGENT', owner: 'Facilities Engineer', estTime: '30 min' },
          { priority: 5, action: 'Perform full particle count sweep of all 8 zones post-filter replacement', urgency: 'URGENT', owner: 'Metrology Team', estTime: '60 min' },
          { priority: 6, action: 'Update HVAC maintenance schedule — reduce interval from 90 to 60 days', urgency: 'ROUTINE', owner: 'Maintenance Manager', estTime: '15 min' },
        ],
      },
    },
  },
];

app.get('/api/demo/investigate', async (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  // Send scenario readings (HVAC Scenario A readings)
  send({
    type: 'SCENARIO_START',
    readings: {
      'lithography-bay': { particles: 0.07, trend: 'stable',   particleSize: '0.3µm' },
      'etch-chamber':    { particles: 0.09, trend: 'stable',   particleSize: '0.3µm' },
      'deposition':      { particles: 0.08, trend: 'stable',   particleSize: '0.3µm' },
      'cmp':             { particles: 0.06, trend: 'stable',   particleSize: '0.3µm' },
      'metrology':       { particles: 0.08, trend: 'stable',   particleSize: '0.3µm' },
      'clean-station':   { particles: 0.09, trend: 'stable',   particleSize: '0.3µm' },
      'hvac-unit-7':     { particles: 2.85, trend: 'rising',   particleSize: '0.3µm' },
      'chemical-storage':{ particles: 1.92, trend: 'rising',   particleSize: '0.3µm' },
    },
  });

  try {
    for (const step of DEMO_MOCK_STEPS) {
      send({ type: 'AGENT_START', ...step.start });
      await delay(step.delay);
      send({ type: 'AGENT_COMPLETE', ...step.complete });
      await delay(800);
    }
    send({ type: 'INVESTIGATION_COMPLETE', totalTime: '~20 sec' });
  } catch (err) {
    send({ type: 'ERROR', message: err.message });
  }

  res.end();
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`ContaminationHunter backend running on http://localhost:${PORT}`);
  startWatchdogPoller();
  startSerialBridge();
});
