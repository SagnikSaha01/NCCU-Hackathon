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

const PORT = 3001;
app.listen(PORT, () => console.log(`ContaminationHunter backend running on http://localhost:${PORT}`));
