import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── Agent definitions ────────────────────────────────────────────────────────
const AGENTS = [
  {
    id: 'SensorCoordinator', label: 'Sensor Coord.', color: '#0ea5e9', icon: '📡',
    description: 'Aggregates real-time particle readings across all 8 cleanroom zones. Classifies each zone as Critical (>1.0 p/m³), Elevated (>0.3 p/m³), or Normal.',
    input: '8-zone readings', output: 'zone status map',
  },
  {
    id: 'PhysicsAgent', label: 'Physics Agent', color: '#6366f1', icon: '🌊',
    description: 'Applies fluid-dynamics reasoning to trace contamination upstream against laminar airflow (0.45 m/s, left→right). Identifies candidate source zones.',
    input: 'zone status map', output: 'source candidate',
  },
  {
    id: 'PatternAgent', label: 'Pattern Agent', color: '#8b5cf6', icon: '🔍',
    description: 'Matches contamination signature against a historical database of 9 known events. Classifies type (HVAC / Tool Seal / Chemical Outgassing) with confidence %.',
    input: 'spread + particle size', output: 'type + confidence',
  },
  {
    id: 'CorrelationAgent', label: 'Correlation', color: '#a855f7', icon: '🔗',
    description: 'Cross-references the suspected source zone with equipment maintenance logs. Flags overdue service records as contributing risk factors.',
    input: 'candidate zones + type', output: 'maint. fingerprint',
  },
  {
    id: 'VerificationAgent', label: 'Verification', color: '#ec4899', icon: '✅',
    description: 'Validates that downstream zones show elevated readings relative to the proposed source, confirming the physics model is internally consistent.',
    input: 'primary candidate', output: 'consistency %',
  },
  {
    id: 'SeverityAgent', label: 'Severity Agent', color: '#f97316', icon: '⚠️',
    description: 'Calculates a composite risk score (0–100), assigns severity (LOW/MEDIUM/HIGH/CRITICAL), and estimates lot value at risk.',
    input: 'verified source', output: 'risk score + level',
  },
  {
    id: 'ResponseAgent', label: 'Response Agent', color: '#22c55e', icon: '🛠️',
    description: 'Synthesizes all prior agent outputs into a final diagnosis and prioritized 6–7 step remediation plan with urgency, owner, and time per action.',
    input: 'all agent outputs', output: 'diagnosis + plan',
  },
];

const AGENT_EDGES = [
  { from: 'SensorCoordinator', to: 'PhysicsAgent' },
  { from: 'PhysicsAgent',      to: 'PatternAgent' },
  { from: 'PatternAgent',      to: 'CorrelationAgent' },
  { from: 'CorrelationAgent',  to: 'VerificationAgent' },
  { from: 'VerificationAgent', to: 'SeverityAgent' },
  { from: 'SeverityAgent',     to: 'ResponseAgent' },
];

// ── Landscape box dimensions — sized to always contain text ──────────────────
// All text fits within these fixed sizes regardless of screen width.
const BX_W = 168;   // landscape width  — wide enough for longest label
const BX_H = 52;    // landscape height — two lines comfortable

const DIM_BORDER = 'rgba(148,163,184,0.25)';
const DIM_FILL   = 'rgba(15,22,41,0.88)';
const DIM_LABEL  = 'rgba(200,214,230,0.90)';  // brighter than before
const DIM_SUB    = 'rgba(120,140,165,0.90)';

// ── Animated dot ──────────────────────────────────────────────────────────────
function FlowDot({ pathRef, color, duration, active }) {
  const dotRef   = useRef(null);
  const animRef  = useRef(null);
  const startRef = useRef(null);

  const tick = useCallback((ts) => {
    if (!pathRef.current || !dotRef.current) return;
    if (!startRef.current) startRef.current = ts;
    const t = ((ts - startRef.current) % (duration * 1000)) / (duration * 1000);
    try {
      const len = pathRef.current.getTotalLength();
      const pt  = pathRef.current.getPointAtLength(t * len);
      dotRef.current.setAttribute('cx', pt.x);
      dotRef.current.setAttribute('cy', pt.y);
    } catch (_) {}
    animRef.current = requestAnimationFrame(tick);
  }, [duration, pathRef]);

  useEffect(() => {
    startRef.current = null;
    animRef.current  = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [tick]);

  return (
    <circle ref={dotRef} r={5} fill={color} opacity={active ? 1 : 0}
      style={{ filter: `drop-shadow(0 0 7px ${color})`, transition: 'opacity 0.3s' }} />
  );
}

function getAgentStatus(agentId, agentEvents) {
  if (agentEvents.find(e => e.type === 'AGENT_COMPLETE' && e.agent === agentId)) return 'complete';
  if (agentEvents.find(e => e.type === 'AGENT_START'    && e.agent === agentId)) return 'active';
  return 'idle';
}

// ── Landscape node — all text clipped hard to box bounds ─────────────────────
function LandscapeNode({ x, y, icon, label, sub, clipId, dragging }) {
  // x,y = top-left corner
  return (
    <g>
      <clipPath id={clipId}>
        <rect x={x} y={y} width={BX_W} height={BX_H} />
      </clipPath>
      <rect x={x} y={y} width={BX_W} height={BX_H} rx={7}
        fill={DIM_FILL}
        stroke={dragging ? 'rgba(14,165,233,0.7)' : DIM_BORDER}
        strokeWidth={dragging ? 1.5 : 1}
        strokeDasharray={dragging ? '0' : '5 3'} />
      {/* Drag handle hint — subtle top bar */}
      <rect x={x} y={y} width={BX_W} height={5} rx={7}
        fill="rgba(148,163,184,0.08)" />
      {/* Icon */}
      <text x={x + 18} y={y + BX_H / 2} fontSize={17}
        textAnchor="middle" dominantBaseline="middle"
        clipPath={`url(#${clipId})`} style={{ userSelect: 'none' }}>
        {icon}
      </text>
      {/* Label */}
      <text x={x + 34} y={y + BX_H * 0.34} fontSize={11.5} fontWeight={700}
        fill={DIM_LABEL} fontFamily="Inter, sans-serif"
        dominantBaseline="middle" clipPath={`url(#${clipId})`}
        style={{ userSelect: 'none' }}>
        {label}
      </text>
      {/* Sub */}
      <text x={x + 34} y={y + BX_H * 0.68} fontSize={9.5}
        fill={DIM_SUB} fontFamily="JetBrains Mono, monospace"
        dominantBaseline="middle" clipPath={`url(#${clipId})`}
        style={{ userSelect: 'none' }}>
        {sub}
      </text>
      {/* Drag cursor hint */}
      <title>Drag to move</title>
    </g>
  );
}

// ── Edge label pill — dark bg so it's always readable ────────────────────────
function EdgePill({ x, y, text, color }) {
  const W = text.length * 6.5 + 16;
  const H = 18;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={x - W / 2} y={y - H / 2} width={W} height={H} rx={4}
        fill="rgba(8,12,24,0.95)" stroke={color} strokeWidth={0.5} strokeOpacity={0.4} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
        fontSize={9.5} fill={color} fontFamily="JetBrains Mono, monospace" fontWeight={600}>
        {text}
      </text>
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AgentFlowMap({ agentEvents = [] }) {
  const containerRef = useRef(null);
  const svgRef       = useRef(null);
  const pathRefs     = useRef({});

  const [dim, setDim]             = useState({ w: 1100, h: 600 });
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // ── Draggable node positions (centre x,y) ────────────────────────────────
  // Keyed by node id. Initialised lazily after first layout measurement.
  const [positions, setPositions] = useState(null);
  const dragging = useRef(null); // { id, startMouseX, startMouseY, startNodeX, startNodeY }

  // ── Measure container ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const measure = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDim({ w: Math.max(width, 500), h: Math.max(height, 320) });
    };

    // Measure after the browser has painted the layout (avoids stale 0/440px reads)
    const raf = requestAnimationFrame(measure);

    const ro = new ResizeObserver(() => measure());
    ro.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const { w, h } = dim;

  // ── Fixed agent spine layout ─────────────────────────────────────────────
  const SPINE_Y  = h * 0.42;  // shifted up to give more room below for two-row data stores
  const PAD_L    = w * 0.03;
  const PAD_R    = w * 0.03;
  const USABLE_W = w - PAD_L - PAD_R;
  // Node centres run from (PAD_L + NW/2) to (w - PAD_R - NW/2)
  // so node EDGES never exceed the padding margins on either side.
  const NW          = Math.max(100, Math.min(148, USABLE_W / 8.2));
  const NH          = 60;
  const SPINE_START = PAD_L + NW / 2;
  const SPINE_END   = w - PAD_R - NW / 2;
  const STEP        = (SPINE_END - SPINE_START) / (AGENTS.length - 1);

  const agentCX = (i) => SPINE_START + i * STEP;

  // ── Default positions for draggable nodes ───────────────────────────────
  // Layout intent:
  //   INPUT ROW  (above spine): trigger → sse → readings, each centred above
  //              the agent it connects to, evenly separated horizontally.
  //   DATA STORE ROW (below spine): four stores spaced under agents 1–4 so
  //              connector lines are short and non-crossing.
  //   OUTPUT COLUMN (right of last agent): three outputs stacked vertically,
  //              close enough to have short connectors but never overlapping.
  const defaultPositions = useCallback(() => {
    // Vertical bands — generous padding so labels/connectors don't collide
    const TOP_Y  = SPINE_Y - NH / 2 - BX_H - 56;  // above spine
    const BOT_Y  = SPINE_Y + NH / 2 + 52;           // below spine

    // Input nodes: spread above agents 0 → 1, centred on their target agent
    // Each box is BX_W wide; keep at least 12px gap between them.
    const safeInpStep = Math.max(BX_W + 12, STEP * 0.9);
    const inpX0 = agentCX(0) - BX_W / 2;

    // Data stores: two rows below spine (alternating) so BX_W-wide boxes never overlap.
    // Row A (closer): agents 1 & 3; Row B (further): agents 2 & 4.
    const BOT_A = BOT_Y;
    const BOT_B = BOT_Y + BX_H + 20;

    // Output nodes: horizontal row below agents 4/5/6
    // Placed in open space below the right side of the spine — never on top of agents.
    const outY   = BOT_A;          // same vertical band as first data-store row
    const outSpan = BX_W + 16;    // horizontal distance between box left edges

    // Centre the group of 3 boxes under agents 4–6
    const outMidX = agentCX(5) - BX_W / 2;

    return {
      // ── INPUT PIPELINE (above spine) ──────────────────────────────────
      trigger:    { x: inpX0,                   y: TOP_Y },
      sse:        { x: inpX0 + safeInpStep,      y: TOP_Y },
      readings:   { x: inpX0 + safeInpStep * 2,  y: TOP_Y },
      // ── DATA STORES — two alternating rows so boxes never overlap ────
      zonemap:    { x: agentCX(1) - BX_W / 2,   y: BOT_A },
      airflow:    { x: agentCX(2) - BX_W / 2,   y: BOT_B },
      patterns:   { x: agentCX(3) - BX_W / 2,   y: BOT_A },
      maintlogs:  { x: agentCX(4) - BX_W / 2,   y: BOT_B },
      // ── OUTPUTS — spread horizontally below agents 4/5/6 ─────────────
      diagnosis:  { x: outMidX - outSpan, y: outY },
      actionplan: { x: outMidX,           y: outY },
      approval:   { x: outMidX + outSpan, y: outY },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h]);

  // Init positions when layout known; reset if canvas changes size a lot
  useEffect(() => {
    setPositions(defaultPositions());
  }, [defaultPositions]);

  // ── Drag handlers ────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((id, e) => {
    e.stopPropagation();
    const svgRect = svgRef.current.getBoundingClientRect();
    dragging.current = {
      id,
      startMouseX: e.clientX - svgRect.left,
      startMouseY: e.clientY - svgRect.top,
      startNodeX:  positions[id].x,
      startNodeY:  positions[id].y,
    };
  }, [positions]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - svgRect.left;
    const my = e.clientY - svgRect.top;
    const dx = mx - dragging.current.startMouseX;
    const dy = my - dragging.current.startMouseY;
    setPositions(prev => ({
      ...prev,
      [dragging.current.id]: {
        x: dragging.current.startNodeX + dx,
        y: dragging.current.startNodeY + dy,
      },
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = null;
  }, []);

  // ── Agent edge paths ─────────────────────────────────────────────────────
  function agentEdgePath(fi, ti) {
    const x1 = agentCX(fi) + NW / 2, x2 = agentCX(ti) - NW / 2, y = SPINE_Y;
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y} C ${cx} ${y}, ${cx} ${y}, ${x2} ${y}`;
  }

  function edgeActive(fromId) {
    return getAgentStatus(fromId, agentEvents) === 'complete';
  }

  AGENT_EDGES.forEach(e => {
    const pid = `path-${e.from}-${e.to}`;
    if (!pathRefs.current[pid]) pathRefs.current[pid] = React.createRef();
  });

  // ── Connector line from a draggable node centre to a fixed agent ─────────
  // node centre = pos.x + BX_W/2, pos.y + BX_H/2
  const lineTo = (pos, ax, ay) => {
    const ncx = pos.x + BX_W / 2;
    const ncy = pos.y + BX_H / 2;
    return `M ${ncx} ${ncy} L ${ax} ${ay}`;
  };

  if (!positions) return null; // wait for layout

  const isComplete = agentEvents.some(e => e.type === 'AGENT_COMPLETE' && e.agent === 'ResponseAgent');
  const isDraggingAny = !!dragging.current;

  return (
    <div ref={containerRef}
      style={{ flex: 1, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative', minHeight: 0, background: 'var(--bg-dark)' }}>

      {/* ── Title bar ── */}
      <div style={{
        padding: '10px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-panel)', display: 'flex', alignItems: 'center',
        gap: 10, flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
          🔀 Agent Pipeline — Live Data Flow
        </span>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)',
          fontFamily: 'JetBrains Mono, monospace', marginLeft: 8 }}>
          {agentEvents.filter(e => e.type === 'AGENT_COMPLETE').length} / 7 agents complete
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center',
          fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
          <span><span style={{ color: '#0ea5e9' }}>■</span> Agents (click)</span>
          <span><span style={{ color: DIM_LABEL }}>⠿</span> Drag to reposition</span>
          <span style={{ color: '#22c55e' }}>● DONE</span>
          <span style={{ color: '#eab308' }}>● RUNNING</span>
          <span style={{ color: '#475569' }}>○ IDLE</span>
        </div>
      </div>

      {/* ── SVG canvas ── */}
      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}
        style={{ flex: 1, display: 'block', cursor: isDraggingAny ? 'grabbing' : 'default', minWidth: 0 }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}>
        <defs>
          {AGENT_EDGES.map(e => {
            const agent  = AGENTS.find(a => a.id === e.from);
            const active = edgeActive(e.from);
            return (
              <marker key={`arr-${e.from}`} id={`arr-${e.from}`}
                markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 9 3.5, 0 7"
                  fill={active ? agent.color : '#1e2d4a'} opacity={active ? 1 : 0.5} />
              </marker>
            );
          })}
          <marker id="arr-dim" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
            <polygon points="0 0, 7 3, 0 6" fill={DIM_BORDER} />
          </marker>
          <marker id="arr-out" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
            <polygon points="0 0, 7 3, 0 6" fill="rgba(34,197,94,0.6)" />
          </marker>
        </defs>

        {/* ══ SECTION LABELS ══════════════════════════════════════════════════ */}
        {[
          { t: '▸ INPUT PIPELINE',  x: PAD_L,           y: positions.trigger.y - 10 },
          { t: '▸ DATA STORES',     x: PAD_L,           y: positions.zonemap.y - 10 },
          { t: '▸ OUTPUTS',         x: positions.diagnosis.x, y: positions.diagnosis.y - 12 },
        ].map(l => (
          <text key={l.t} x={l.x} y={l.y} fontSize={10} fontWeight={700} fill={DIM_SUB}
            fontFamily="JetBrains Mono, monospace" letterSpacing="0.08em">
            {l.t}
          </text>
        ))}

        {/* ══ INPUT NODE CONNECTORS ═══════════════════════════════════════════ */}
        {/* trigger → sse */}
        <path d={`M ${positions.trigger.x + BX_W} ${positions.trigger.y + BX_H/2} L ${positions.sse.x} ${positions.sse.y + BX_H/2}`}
          fill="none" stroke={DIM_BORDER} strokeWidth={1.5} markerEnd="url(#arr-dim)" />
        {/* sse → readings */}
        <path d={`M ${positions.sse.x + BX_W} ${positions.sse.y + BX_H/2} L ${positions.readings.x} ${positions.readings.y + BX_H/2}`}
          fill="none" stroke={DIM_BORDER} strokeWidth={1.5} markerEnd="url(#arr-dim)" />
        {/* readings → SensorCoordinator */}
        <path d={lineTo(positions.readings, agentCX(0), SPINE_Y - NH / 2)}
          fill="none" stroke={DIM_BORDER} strokeWidth={1.5}
          strokeDasharray="5 4" markerEnd="url(#arr-dim)" />

        {/* ══ STORE → AGENT CONNECTORS ════════════════════════════════════════ */}
        {[
          { id: 'zonemap',   agentIdx: 1 },   // PhysicsAgent reads zone map
          { id: 'airflow',   agentIdx: 1 },   // PhysicsAgent reads airflow model
          { id: 'patterns',  agentIdx: 2 },   // PatternAgent reads historical patterns
          { id: 'maintlogs', agentIdx: 3 },   // CorrelationAgent reads maintenance logs
        ].map(s => (
          <path key={s.id}
            d={lineTo(positions[s.id], agentCX(s.agentIdx), SPINE_Y + NH / 2)}
            fill="none" stroke={DIM_BORDER} strokeWidth={1.2}
            strokeDasharray="4 3" markerEnd="url(#arr-dim)" />
        ))}

        {/* ══ RESPONSE AGENT → OUTPUT CONNECTORS ══════════════════════════════ */}
        {/* Connectors drop from the bottom of ResponseAgent down to each output box */}
        {['diagnosis', 'actionplan', 'approval'].map(id => {
          const pos = positions[id];
          const sx = agentCX(6);          // agent centre x
          const sy = SPINE_Y + NH / 2;    // agent bottom edge
          const tx = pos.x + BX_W / 2;   // output box centre x
          const ty = pos.y;               // output box top edge
          return (
            <path key={id}
              d={`M ${sx} ${sy} C ${sx} ${(sy + ty) / 2}, ${tx} ${(sy + ty) / 2}, ${tx} ${ty}`}
              fill="none" stroke="rgba(34,197,94,0.3)"
              strokeWidth={1.3} strokeDasharray="4 3" markerEnd="url(#arr-out)" />
          );
        })}

        {/* ══ AGENT EDGES (main spine) ════════════════════════════════════════ */}
        {AGENT_EDGES.map((e) => {
          const fi  = AGENTS.findIndex(a => a.id === e.from);
          const ti  = AGENTS.findIndex(a => a.id === e.to);
          const active     = edgeActive(e.from);
          const fromAgent  = AGENTS[fi];
          const d          = agentEdgePath(fi, ti);
          const pid        = `path-${e.from}-${e.to}`;
          const midX       = (agentCX(fi) + NW/2 + agentCX(ti) - NW/2) / 2;
          const midY       = SPINE_Y - NH/2 - 14;

          return (
            <g key={pid}>
              <path d={d} fill="none" stroke="#1e2d4a" strokeWidth={2} />
              <path ref={pathRefs.current[pid]} id={pid} d={d}
                fill="none" stroke={fromAgent.color}
                strokeWidth={active ? 2.5 : 0}
                strokeOpacity={active ? 0.8 : 0}
                markerEnd={`url(#arr-${e.from})`}
                style={{ transition: 'stroke-opacity 0.5s, stroke-width 0.5s' }} />
              {active && <EdgePill x={midX} y={midY} text={fromAgent.output} color={fromAgent.color} />}
              {active && <FlowDot pathRef={pathRefs.current[pid]} color={fromAgent.color} duration={1.5} active />}
            </g>
          );
        })}

        {/* ══ INPUT NODES (draggable) ═════════════════════════════════════════ */}
        {[
          { id: 'trigger',  icon: '▶', label: 'Scenario Trigger', sub: 'User selects A / B / C' },
          { id: 'sse',      icon: '⚡', label: 'SSE Endpoint',     sub: '/api/investigate/:key' },
          { id: 'readings', icon: '📊', label: 'Sensor Readings',  sub: '8 zones · particles/trend/size' },
        ].map(inp => {
          const pos = positions[inp.id];
          const isBeingDragged = dragging.current?.id === inp.id;
          return (
            <g key={inp.id}
              style={{ cursor: 'grab' }}
              onMouseDown={(e) => handleMouseDown(inp.id, e)}>
              <LandscapeNode x={pos.x} y={pos.y}
                icon={inp.icon} label={inp.label} sub={inp.sub}
                clipId={`clip-${inp.id}`} dragging={isBeingDragged} />
            </g>
          );
        })}

        {/* ══ DATA STORE NODES (draggable) ════════════════════════════════════ */}
        {[
          { id: 'zonemap',   icon: '🗺',  label: 'Zone Map',        sub: '8 zones · row/col grid' },
          { id: 'airflow',   icon: '💨',  label: 'Airflow Model',   sub: '0.45 m/s · left → right' },
          { id: 'patterns',  icon: '📜',  label: 'Hist. Patterns',  sub: '9 events · 3 types' },
          { id: 'maintlogs', icon: '🔧',  label: 'Maint. Logs',     sub: '8 zones · overdue flags' },
        ].map(s => {
          const pos = positions[s.id];
          const isBeingDragged = dragging.current?.id === s.id;
          return (
            <g key={s.id} style={{ cursor: 'grab' }}
              onMouseDown={(e) => handleMouseDown(s.id, e)}>
              {/* Cylinder cap */}
              <ellipse cx={pos.x + BX_W/2} cy={pos.y}
                rx={BX_W/2} ry={6}
                fill="rgba(30,45,74,0.7)" stroke={DIM_BORDER} strokeWidth={1} />
              <LandscapeNode x={pos.x} y={pos.y}
                icon={s.icon} label={s.label} sub={s.sub}
                clipId={`clip-${s.id}`} dragging={isBeingDragged} />
            </g>
          );
        })}

        {/* ══ AGENT NODES (fixed, non-draggable) ════════════════════════════ */}
        {AGENTS.map((agent, i) => {
          const cx = agentCX(i), cy = SPINE_Y;
          const nx = cx - NW/2, ny = cy - NH/2;
          const status     = getAgentStatus(agent.id, agentEvents);
          const isSelected = selectedAgent?.id === agent.id;
          const bgColor    = status === 'complete' ? `${agent.color}22`
                           : status === 'active'   ? `${agent.color}18` : '#0f1629';
          const border     = status !== 'idle' ? agent.color : '#1e2d4a';

          return (
            <g key={agent.id}
              onClick={() => { setSelectedAgent(isSelected ? null : agent); setPanelOpen(true); }}
              style={{ cursor: 'pointer' }}>
              {status !== 'idle' && (
                <rect x={nx-5} y={ny-5} width={NW+10} height={NH+10} rx={12}
                  fill="none" stroke={agent.color}
                  strokeWidth={status === 'active' ? 2 : 1.5}
                  opacity={status === 'active' ? 0.5 : 0.2}
                  style={{ filter: `blur(${status === 'active' ? 9 : 5}px)`,
                    animation: status === 'active' ? 'flowPulse 1.4s ease-in-out infinite' : 'none' }} />
              )}
              <rect x={nx} y={ny} width={NW} height={NH} rx={8}
                fill={bgColor} stroke={isSelected ? 'white' : border}
                strokeWidth={isSelected ? 2 : 1} style={{ transition: 'all 0.3s' }} />
              <circle cx={nx+NW-12} cy={ny+12} r={5}
                fill={status === 'complete' ? '#22c55e' : status === 'active' ? agent.color : '#1e2d4a'}
                style={{
                  filter: status !== 'idle' ? `drop-shadow(0 0 5px ${status === 'complete' ? '#22c55e' : agent.color})` : 'none',
                  animation: status === 'active' ? 'flowPulse 1s ease-in-out infinite' : 'none' }} />
              <text x={nx+15} y={cy} fontSize={16} textAnchor="middle"
                dominantBaseline="middle" style={{ userSelect: 'none' }}>{agent.icon}</text>
              <text x={nx+28} y={cy} fontSize={11} fontWeight={700}
                fill={status !== 'idle' ? agent.color : '#94a3b8'}
                fontFamily="Inter, sans-serif" dominantBaseline="middle"
                style={{ transition: 'fill 0.3s', userSelect: 'none' }}>{agent.label}</text>
              {/* Status pill */}
              {(() => {
                const txt = status === 'complete' ? '✓ DONE' : status === 'active' ? '● RUNNING' : '○ IDLE';
                const clr = status === 'complete' ? '#22c55e' : status === 'active' ? agent.color : '#475569';
                const pw  = txt.length * 6.5 + 14;
                return (
                  <g>
                    <rect x={cx - pw/2} y={ny+NH+4} width={pw} height={17} rx={4}
                      fill="rgba(8,12,24,0.92)" />
                    <text x={cx} y={ny+NH+13} textAnchor="middle" dominantBaseline="middle"
                      fontSize={9.5} fill={clr} fontFamily="JetBrains Mono, monospace" fontWeight={600}
                      style={{ userSelect: 'none' }}>{txt}</text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* ══ OUTPUT NODES (draggable) ════════════════════════════════════════ */}
        {[
          { id: 'diagnosis',  icon: '🔬', label: 'Diagnosis',      sub: 'source · type · confidence',  color: '#22c55e' },
          { id: 'actionplan', icon: '📋', label: 'Action Plan',    sub: '6-7 steps · urgency · owner',  color: '#22c55e' },
          { id: 'approval',   icon: '👤', label: 'Eng. Approval',  sub: 'human-in-the-loop gate',       color: '#eab308' },
        ].map(out => {
          const pos = positions[out.id];
          const isAct = isComplete;
          const isBeingDragged = dragging.current?.id === out.id;
          return (
            <g key={out.id} style={{ cursor: 'grab' }}
              onMouseDown={(e) => handleMouseDown(out.id, e)}>
              <rect x={pos.x} y={pos.y} width={BX_W} height={BX_H} rx={7}
                fill={isAct ? 'rgba(34,197,94,0.07)' : DIM_FILL}
                stroke={isBeingDragged ? 'white' : isAct ? out.color : DIM_BORDER}
                strokeWidth={isBeingDragged ? 2 : 1}
                strokeDasharray={isAct ? '0' : '5 3'}
                style={{ transition: 'all 0.4s' }} />
              <rect x={pos.x} y={pos.y} width={BX_W} height={5} rx={7}
                fill="rgba(148,163,184,0.08)" />
              <text x={pos.x+18} y={pos.y+BX_H/2} fontSize={17} textAnchor="middle"
                dominantBaseline="middle" style={{ userSelect: 'none' }}>{out.icon}</text>
              <clipPath id={`clip-${out.id}`}>
                <rect x={pos.x} y={pos.y} width={BX_W} height={BX_H} />
              </clipPath>
              <text x={pos.x+34} y={pos.y+BX_H*0.34} fontSize={11.5} fontWeight={700}
                fill={isAct ? (out.color === '#eab308' ? '#eab308' : '#e2e8f0') : DIM_LABEL}
                fontFamily="Inter, sans-serif" dominantBaseline="middle"
                clipPath={`url(#clip-${out.id})`} style={{ transition: 'fill 0.4s', userSelect: 'none' }}>
                {out.label}
              </text>
              <text x={pos.x+34} y={pos.y+BX_H*0.68} fontSize={9.5}
                fill={DIM_SUB} fontFamily="JetBrains Mono, monospace" dominantBaseline="middle"
                clipPath={`url(#clip-${out.id})`} style={{ userSelect: 'none' }}>
                {out.sub}
              </text>
              <title>Drag to move</title>
            </g>
          );
        })}

        {/* ══ DECORATIVE BADGES ═══════════════════════════════════════════════ */}
        {/* ISO Class 5 — top right */}
        {(() => {
          const bw = 152, bh = 40, bx = w - bw - 14, by = 10;
          return (
            <g>
              <rect x={bx} y={by} width={bw} height={bh} rx={6}
                fill="rgba(14,165,233,0.07)" stroke="rgba(14,165,233,0.3)" strokeWidth={1} />
              <text x={bx+bw/2} y={by+14} textAnchor="middle" fontSize={11}
                fill="rgba(14,165,233,0.9)" fontFamily="JetBrains Mono, monospace" fontWeight={700}>
                ISO CLASS 5
              </text>
              <text x={bx+bw/2} y={by+29} textAnchor="middle" fontSize={9.5}
                fill={DIM_SUB} fontFamily="JetBrains Mono, monospace">
                ≤100 particles/ft³ · 0.3µm+
              </text>
            </g>
          );
        })()}

        {/* Completion badge — bottom right */}
        {isComplete && (() => {
          const bw = 158, bh = 44, bx = w - bw - 14, by = h - bh - 12;
          return (
            <g>
              <rect x={bx} y={by} width={bw} height={bh} rx={6}
                fill="rgba(34,197,94,0.09)" stroke="rgba(34,197,94,0.4)" strokeWidth={1} />
              <text x={bx+bw/2} y={by+16} textAnchor="middle"
                fontSize={13} fill="#22c55e" fontFamily="JetBrains Mono, monospace" fontWeight={700}>
                ✓ ~2 min 17 sec
              </text>
              <text x={bx+bw/2} y={by+32} textAnchor="middle"
                fontSize={9.5} fill={DIM_SUB} fontFamily="JetBrains Mono, monospace">
                vs 4-8 hrs manual investigation
              </text>
            </g>
          );
        })()}

      </svg>

      {/* ── Flow Details button ── */}
      <button onClick={() => setPanelOpen(p => !p)}
        style={{
          position: 'absolute', bottom: 20, right: 20,
          background: panelOpen ? 'rgba(14,165,233,0.22)' : 'rgba(15,22,41,0.92)',
          border: '1px solid var(--accent-blue)', borderRadius: 20,
          color: 'var(--accent-blue)', fontSize: '0.72rem',
          fontFamily: 'JetBrains Mono, monospace', padding: '7px 16px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
          zIndex: 10, backdropFilter: 'blur(10px)', transition: 'all 0.2s',
          boxShadow: panelOpen ? '0 0 14px rgba(14,165,233,0.3)' : 'none',
        }}>
        <span>ℹ</span>
        {panelOpen ? 'Hide Details' : 'Flow Details'}
      </button>

      {/* ── Detail panel ── */}
      {panelOpen && (
        <div style={{
          position: 'absolute', bottom: 60, right: 20,
          width: 310, maxHeight: '65vh', overflowY: 'auto',
          background: '#0f1629', border: '1px solid #1e2d4a', borderRadius: 10,
          padding: 18, zIndex: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
          animation: 'flowFadeIn 0.2s ease forwards',
        }}>
          {selectedAgent ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: '1.3rem' }}>{selectedAgent.icon}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: selectedAgent.color,
                  fontFamily: 'JetBrains Mono, monospace' }}>{selectedAgent.id}</span>
                <button onClick={() => setSelectedAgent(null)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none',
                    color: '#475569', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.65, marginBottom: 12 }}>
                {selectedAgent.description}
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[{ label: 'INPUT', val: selectedAgent.input }, { label: 'OUTPUT', val: selectedAgent.output }].map(r => (
                  <div key={r.label} style={{ flex: 1, padding: '8px 10px',
                    background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '1px solid #1e2d4a' }}>
                    <div style={{ fontSize: '0.62rem', color: '#475569',
                      fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>{r.label}</div>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{r.val}</div>
                  </div>
                ))}
              </div>
              {(() => {
                const ev = agentEvents.find(e => e.type === 'AGENT_COMPLETE' && e.agent === selectedAgent.id);
                if (!ev) return <div style={{ fontSize: '0.72rem', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>No output yet.</div>;
                return (
                  <div style={{ padding: '10px 12px', background: `${selectedAgent.color}14`,
                    border: `1px solid ${selectedAgent.color}40`, borderRadius: 7 }}>
                    <div style={{ fontSize: '0.62rem', color: '#475569', fontFamily: 'JetBrains Mono, monospace',
                      marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Output</div>
                    <div style={{ fontSize: '0.76rem', color: '#e2e8f0', lineHeight: 1.55 }}>{ev.summary}</div>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.7rem', color: '#475569', fontFamily: 'JetBrains Mono, monospace',
                marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Full System Flow</div>
              <p style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.65, marginBottom: 14 }}>
                User triggers a scenario → SSE endpoint streams events → 7 agents run sequentially,
                consulting data stores → diagnosis + action plan → engineer approval.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Trigger', sub: 'Scenario A/B/C selected by user', color: DIM_LABEL },
                  { label: 'SSE Endpoint', sub: '/api/investigate/:key → streams events', color: DIM_LABEL },
                  { label: 'Sensor Readings', sub: '8 zones × particles, trend, size', color: DIM_LABEL },
                  { label: '7 Agent Pipeline', sub: 'Sequential · each builds on last', color: '#0ea5e9' },
                  { label: 'Data Stores', sub: 'Zone map · airflow · patterns · maint. logs', color: DIM_LABEL },
                  { label: 'Outputs', sub: 'Diagnosis · action plan · approval', color: '#22c55e' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: row.color, marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#e2e8f0' }}>{row.label}</div>
                      <div style={{ fontSize: '0.67rem', color: '#475569', fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>{row.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #1e2d4a',
                fontSize: '0.68rem', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                Click agent nodes to inspect. Drag other boxes to rearrange.
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes flowPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes flowFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
