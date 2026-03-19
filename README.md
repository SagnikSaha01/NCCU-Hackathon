# ContaminationHunter
### AI-Powered Semiconductor Fab Contamination Detection — IBM watsonx Orchestrate

When a particle contamination spike hits a semiconductor cleanroom, every minute costs thousands of dollars in scrapped wafers. Manual investigation takes **4–8 hours**. ContaminationHunter uses 7 AI agents orchestrated by IBM watsonx Orchestrate to triangulate the source and generate a containment plan in **~2 minutes**.

---

## Demo

Three scenarios can be triggered live:

| Scenario | Event | Source Zone |
|---|---|---|
| A | HVAC Filter Failure | HVAC Unit #7 — gradual spread rightward |
| B | Tool Seal Breach | Etch Chamber — sharp localized spike |
| C | Chemical Outgassing | Chemical Storage — slow diffuse spread |

---

## Architecture

```
Browser (React + D3.js)
    ↕ Server-Sent Events (real-time streaming)
Express Backend (Node.js)
    ↓ Sequential pipeline
IBM watsonx Orchestrate — 7 Agents
    ↓ Knowledge files per agent
Historical contamination + maintenance data
```

### The 7 Agents

| # | Agent | Role | Knowledge |
|---|---|---|---|
| 1 | SensorCoordinator | Aggregates 8 zone readings, classifies NORMAL / ELEVATED / CRITICAL, cross-references baselines | zone_baselines.txt |
| 2 | PhysicsAgent | Traces contamination upstream against unidirectional laminar airflow (left → right) | — |
| 3 | PatternAgent | Matches spike signature to HVAC_FILTER_FAILURE / TOOL_SEAL_BREACH / CHEMICAL_OUTGASSING | contamination_history.txt |
| 4 | CorrelationAgent | Cross-references equipment maintenance logs for overdue service in candidate zones | maintenance_history.txt |
| 5 | VerificationAgent | Validates hypothesis — checks spread pattern is physically consistent with proposed source | — |
| 6 | SeverityAgent | Scores risk CRITICAL / HIGH / MEDIUM / LOW, estimates lot value at risk | lot_loss_history.txt |
| 7 | ResponseAgent | Generates prioritized action plan — **recommendations only, awaiting engineer approval** | — |

Agents run **sequentially**. Each agent receives the previous agent's output. The Express backend manages sequencing and streams each agent's result to the browser via SSE as it completes, so judges can watch the reasoning unfold in real time.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, D3.js, Vite |
| Backend | Node.js, Express |
| AI Agents | IBM watsonx Orchestrate (ReAct mode) |
| Auth | IBM IAM JWT token exchange |
| Realtime | Server-Sent Events (SSE) |
| Knowledge | Historical JSON data per agent |

---

## Fab Floor Layout

```
Airflow →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

[ Lithography Bay ] [ Etch Chamber ] [ Deposition  ] [    CMP      ]
[   Metrology     ] [ Clean Station] [ HVAC Unit #7] [Chem Storage ]

                                        col 0          col 3
```

ISO Class 5 cleanroom. Unidirectional laminar airflow at 0.45 m/s left to right. Contamination source is always the most upstream (leftmost) elevated zone.

---

## Project Structure

```
ContaminationHunter/
├── backend/
│   ├── server.js                  # Express + SSE orchestration pipeline
│   ├── .env                       # API keys + 7 agent UUIDs (not committed)
│   ├── services/
│   │   └── orchestrateClient.js   # JWT auth + Orchestrate API client
│   ├── agents/                    # 7 agent wrappers (prompt → Orchestrate → parse)
│   │   ├── sensorCoordinator.js
│   │   ├── physicsAgent.js
│   │   ├── patternAgent.js
│   │   ├── correlationAgent.js
│   │   ├── verificationAgent.js
│   │   ├── severityAgent.js
│   │   └── responseAgent.js
│   └── data/
│       ├── scenarios.js           # 3 demo scenarios with sensor readings
│       └── maintenanceLogs.js     # Equipment maintenance data
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Main layout + SSE EventSource
│   │   └── components/
│   │       ├── FabMap.jsx         # D3.js 2D cleanroom floor map
│   │       ├── AgentFeed.jsx      # Live agent activity feed
│   │       ├── DiagnosisCard.jsx  # Final diagnosis + response plan
│   │       ├── SensorStatus.jsx   # Per-zone sensor detail cards
│   │       ├── Timeline.jsx       # AI vs manual time comparison bar
│   │       └── ScenarioButtons.jsx
└── agent_knowledge_data/          # Uploaded to Orchestrate Knowledge tabs
    ├── zone_baselines.txt
    ├── contamination_history.txt
    ├── maintinence_history.txt
    └── lot_loss_history.txt
```

---

## Running Locally

**Prerequisites:** Node.js 18+, IBM watsonx Orchestrate instance with 7 deployed agents

```bash
# 1. Clone and install
cd backend  && npm install
cd frontend && npm install

# 2. Configure credentials
# Edit backend/.env — add IBM_KEY, SERVER_INSTANCE, and all 7 AGENT_* UUIDs

# 3. Start backend (port 3001)
cd backend && npm start

# 4. Start frontend (port 3000)
cd frontend && npm run dev

# 5. Open http://localhost:3000
```

---

## Environment Variables

```env
IBM_KEY=<your-orchestrate-api-key>
SERVER_INSTANCE=https://api.dl.watson-orchestrate.ibm.com/instances/<instance-id>

AGENT_SENSOR_COORDINATOR=<uuid>
AGENT_PHYSICS=<uuid>
AGENT_PATTERN=<uuid>
AGENT_CORRELATION=<uuid>
AGENT_VERIFICATION=<uuid>
AGENT_SEVERITY=<uuid>
AGENT_RESPONSE=<uuid>
```

---

## Key Design Decisions

**Why sequential agents, not parallel?**
The investigation is a logical chain — PhysicsAgent needs SensorCoordinator's output to know which zones are affected, CorrelationAgent needs PhysicsAgent's candidate zones. Running in parallel would break the reasoning chain. Sequential execution also lets the UI show each agent thinking in real time, which is the demo's strongest visual.

**Why SSE instead of WebSockets?**
Data only flows one way — server to browser. SSE is simpler, uses plain HTTP, and auto-reconnects. No need for the added complexity of WebSockets.

**Why keep the backend as the sequencer?**
IBM Orchestrate supports native agent-to-agent delegation, but using it would mean Orchestrate runs the full chain internally and returns a single final response — losing the live per-agent streaming that makes the demo compelling.

**ResponseAgent recommendations only**
The final agent outputs a prioritized action plan framed as recommendations awaiting engineer approval. The system never takes autonomous action. This is intentional — in a real fab, autonomous shutdowns require human sign-off.

---

## The Business Case

| Metric | Manual | ContaminationHunter |
|---|---|---|
| Detection time | 4–8 hours | ~2 minutes |
| Lot value at risk (HVAC failure) | $2.8M (INC-9012) | $850K (caught early) |
| Wafers scrapped | 850 | ~24 |
| Night shift coverage | None | 24/7 |
