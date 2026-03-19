import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── Agent definitions ────────────────────────────────────────────────────────
const AGENTS = [
  {
    id: 'SensorCoordinator',
    label: 'Sensor\nCoordinator',
    shortLabel: 'SC',
    color: '#0ea5e9',
    description: 'Aggregates real-time particle readings across all 8 cleanroom zones. Classifies each zone as Critical (>1.0 p/m³), Elevated (>0.3 p/m³), or Normal. Outputs a structured zone-status map used by all downstream agents.',
    icon: '📡',
  },
  {
    id: 'PhysicsAgent',
    label: 'Physics\nAgent',
    shortLabel: 'PA',
    color: '#6366f1',
    description: 'Applies fluid-dynamics reasoning to trace contamination upstream against laminar airflow (0.45 m/s, left→right). Identifies candidate source zones based on spatial gradient analysis.',
    icon: '🌊',
  },
  {
    id: 'PatternAgent',
    label: 'Pattern\nAgent',
    shortLabel: 'PTA',
    color: '#8b5cf6',
    description: 'Matches the contamination signature — particle size, spread rate, zone gradient — against a historical database of 9 known events. Classifies contamination type (HVAC, Tool Seal, Chemical Outgassing) with a confidence score.',
    icon: '🔍',
  },
  {
    id: 'CorrelationAgent',
    label: 'Correlation\nAgent',
    shortLabel: 'CA',
    color: '#a855f7',
    description: 'Cross-references the suspected source zone with equipment maintenance logs. Flags overdue service records, recent interventions, and equipment age as contributing risk factors.',
    icon: '🔗',
  },
  {
    id: 'VerificationAgent',
    label: 'Verification\nAgent',
    shortLabel: 'VA',
    color: '#ec4899',
    description: 'Performs a consistency check — validates that downstream zones show elevated readings relative to the proposed source, confirming the physics model and pattern match are internally consistent.',
    icon: '✅',
  },
  {
    id: 'SeverityAgent',
    label: 'Severity\nAgent',
    shortLabel: 'SA',
    color: '#f97316',
    description: 'Calculates a composite risk score (0–100), assigns a severity level (LOW / MEDIUM / HIGH / CRITICAL), and estimates the lot value at risk based on active wafer inventory and contamination spread.',
    icon: '⚠️',
  },
  {
    id: 'ResponseAgent',
    label: 'Response\nAgent',
    shortLabel: 'RA',
    color: '#22c55e',
    description: 'Synthesizes all prior agent outputs into a final diagnosis and a prioritized 6–7 step remediation plan. Each action includes urgency, responsible owner, and estimated completion time.',
    icon: '🛠️',
  },
];

const EDGES = [
  { from: 'SensorCoordinator', to: 'PhysicsAgent',     label: 'zone status' },
  { from: 'PhysicsAgent',      to: 'PatternAgent',      label: 'source candidate' },
  { from: 'PatternAgent',      to: 'CorrelationAgent',  label: 'contamination type' },
  { from: 'CorrelationAgent',  to: 'VerificationAgent', label: 'maintenance data' },
  { from: 'VerificationAgent', to: 'SeverityAgent',     label: 'verified source' },
  { from: 'SeverityAgent',     to: 'ResponseAgent',     label: 'risk score' },
];

function getAgentStatus(agentId, agentEvents) {
  if (agentEvents.find(e => e.type === 'AGENT_COMPLETE' && e.agent === agentId)) return 'complete';
  if (agentEvents.find(e => e.type === 'AGENT_START'    && e.agent === agentId)) return 'active';
  return 'idle';
}

// ─── Animated dot travelling along an SVG path ────────────────────────────────
function FlowDot({ pathRef, color, duration, active }) {
  const dotRef = useRef(null);
  const animRef = useRef(null);
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
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [tick]);

  return (
    <circle
      ref={dotRef}
      r={6}
      fill={color}
      opacity={active ? 1 : 0}
      style={{ filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 3px ${color})`, transition: 'opacity 0.3s' }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AgentFlowMap({ agentEvents = [] }) {
  const containerRef = useRef(null);
  const pathRefs     = useRef({});
  const [dim, setDim]               = useState({ w: 800, h: 500 });
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [panelOpen, setPanelOpen]   = useState(false);

  // Measure the container whenever it resizes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDim({ w: Math.max(width, 300), h: Math.max(height, 200) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const { w, h } = dim;
  const isWide = w > h * 1.2; // horizontal layout when wide

  // Node size — scale up a bit in wide mode
  const NW = isWide ? 150 : 134;
  const NH = isWide ? 64  : 56;
  const PAD_X = isWide ? 0.07 : 0.5;
  const PAD_Y = isWide ? 0.5  : 0.06;

  // Compute pixel centre for each node
  const nodePixels = {};
  AGENTS.forEach((a, i) => {
    const t = i / (AGENTS.length - 1);
    nodePixels[a.id] = isWide
      ? { x: (PAD_X + t * (1 - 2 * PAD_X)) * w, y: PAD_Y * h }
      : { x: PAD_X * w, y: (PAD_Y + t * (1 - 2 * PAD_Y)) * h };
  });

  // Cubic bezier path between two nodes
  function edgePath(fromId, toId) {
    const f = nodePixels[fromId];
    const t = nodePixels[toId];
    if (isWide) {
      const x1 = f.x + NW / 2, y1 = f.y;
      const x2 = t.x - NW / 2, y2 = t.y;
      const cx = (x1 + x2) / 2;
      return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
    } else {
      const x1 = f.x, y1 = f.y + NH / 2;
      const x2 = t.x, y2 = t.y - NH / 2;
      const cy = (y1 + y2) / 2;
      return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`;
    }
  }

  function edgeActive(fromId) {
    return getAgentStatus(fromId, agentEvents) === 'complete';
  }

  // Edge label midpoint
  function edgeLabelPos(fromId, toId) {
    const f = nodePixels[fromId];
    const t = nodePixels[toId];
    return isWide
      ? { x: (f.x + t.x) / 2, y: f.y - 14 }
      : { x: f.x + NW / 2 + 8, y: (f.y + t.y) / 2, anchor: 'start' };
  }

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', minHeight: 0, background: 'var(--bg-dark)' }}
    >
      {/* ── Title bar ── */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
          🔀 Agent Pipeline — Live Data Flow
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginLeft: 8 }}>
          {agentEvents.filter(e => e.type === 'AGENT_COMPLETE').length} / 7 agents complete
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center', fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
          <span><span style={{ color: '#22c55e' }}>●</span> DONE</span>
          <span><span style={{ color: '#0ea5e9', animation: 'flowPulse 1s infinite' }}>●</span> RUNNING</span>
          <span><span style={{ color: '#1e2d4a' }}>○</span> IDLE</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>Click node for details</span>
        </div>
      </div>

      {/* ── SVG canvas ── */}
      <svg
        width={w}
        height={h - 44}
        viewBox={`0 0 ${w} ${h - 44}`}
        style={{ flex: 1, display: 'block' }}
      >
        <defs>
          {EDGES.map(e => {
            const active = edgeActive(e.from);
            const fromAgent = AGENTS.find(a => a.id === e.from);
            return (
              <marker
                key={`arrow-${e.from}`}
                id={`arrow-${e.from}`}
                markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"
              >
                <polygon
                  points="0 0, 9 3.5, 0 7"
                  fill={active ? fromAgent.color : '#1e2d4a'}
                  opacity={active ? 1 : 0.5}
                />
              </marker>
            );
          })}
        </defs>

        {/* ── Edges ── */}
        {EDGES.map(e => {
          const active = edgeActive(e.from);
          const fromAgent = AGENTS.find(a => a.id === e.from);
          const d = edgePath(e.from, e.to);
          const pid = `path-${e.from}-${e.to}`;
          if (!pathRefs.current[pid]) pathRefs.current[pid] = React.createRef();
          const lp = edgeLabelPos(e.from, e.to);

          return (
            <g key={pid}>
              {/* dim background track */}
              <path d={d} fill="none" stroke="#1e2d4a" strokeWidth={2} />
              {/* active coloured track */}
              <path
                ref={pathRefs.current[pid]}
                id={pid}
                d={d}
                fill="none"
                stroke={fromAgent.color}
                strokeWidth={active ? 2.5 : 0}
                strokeOpacity={active ? 0.7 : 0}
                markerEnd={`url(#arrow-${e.from})`}
                style={{ transition: 'stroke-opacity 0.6s, stroke-width 0.6s' }}
              />
              {/* data label */}
              {active && (
                <text
                  x={lp.x} y={lp.y}
                  textAnchor={lp.anchor || 'middle'}
                  fontSize={isWide ? 10 : 9}
                  fill={fromAgent.color}
                  opacity={0.75}
                  fontFamily="JetBrains Mono, monospace"
                  style={{ pointerEvents: 'none' }}
                >
                  {e.label}
                </text>
              )}
              {/* animated dot */}
              {active && (
                <FlowDot
                  pathRef={pathRefs.current[pid]}
                  color={fromAgent.color}
                  duration={1.6}
                  active={active}
                />
              )}
            </g>
          );
        })}

        {/* ── Nodes ── */}
        {AGENTS.map(agent => {
          const { x, y } = nodePixels[agent.id];
          const status = getAgentStatus(agent.id, agentEvents);
          const isSelected = selectedAgent?.id === agent.id;
          const nx = x - NW / 2;
          const ny = y - NH / 2;

          const borderColor = status !== 'idle' ? agent.color : '#1e2d4a';
          const bgColor     = status === 'complete' ? `${agent.color}22`
                            : status === 'active'   ? `${agent.color}16`
                            : '#0f1629';

          return (
            <g
              key={agent.id}
              onClick={() => { setSelectedAgent(isSelected ? null : agent); setPanelOpen(true); }}
              style={{ cursor: 'pointer' }}
            >
              {/* glow halo for active/complete */}
              {status !== 'idle' && (
                <rect
                  x={nx - 5} y={ny - 5}
                  width={NW + 10} height={NH + 10}
                  rx={13} fill="none"
                  stroke={agent.color}
                  strokeWidth={status === 'active' ? 2 : 1.5}
                  opacity={status === 'active' ? 0.5 : 0.25}
                  style={{
                    filter: `blur(${status === 'active' ? 8 : 5}px)`,
                    animation: status === 'active' ? 'flowPulse 1.4s ease-in-out infinite' : 'none',
                  }}
                />
              )}
              {/* node body */}
              <rect
                x={nx} y={ny} width={NW} height={NH} rx={9}
                fill={bgColor}
                stroke={isSelected ? 'white' : borderColor}
                strokeWidth={isSelected ? 2 : 1}
                style={{ transition: 'all 0.3s' }}
              />
              {/* status pip */}
              <circle
                cx={nx + NW - 13} cy={ny + 13} r={5}
                fill={status === 'complete' ? '#22c55e' : status === 'active' ? agent.color : '#1e2d4a'}
                style={{
                  filter: status !== 'idle' ? `drop-shadow(0 0 5px ${status === 'complete' ? '#22c55e' : agent.color})` : 'none',
                  animation: status === 'active' ? 'flowPulse 1s ease-in-out infinite' : 'none',
                }}
              />
              {/* icon */}
              <text x={nx + 16} y={ny + NH / 2 + 6} fontSize={isWide ? 18 : 16} textAnchor="middle" style={{ userSelect: 'none' }}>
                {agent.icon}
              </text>
              {/* name lines */}
              {agent.label.split('\n').map((line, i) => (
                <text
                  key={i}
                  x={nx + 30} y={ny + NH / 2 - 4 + i * (isWide ? 15 : 13)}
                  fontSize={isWide ? 12 : 11}
                  fontWeight={600}
                  fill={status !== 'idle' ? agent.color : '#94a3b8'}
                  fontFamily="Inter, sans-serif"
                  style={{ transition: 'fill 0.3s', userSelect: 'none' }}
                >
                  {line}
                </text>
              ))}
              {/* status label below node */}
              <text
                x={x} y={ny + NH + (isWide ? 16 : 14)}
                textAnchor="middle"
                fontSize={isWide ? 10 : 9}
                fill={status === 'complete' ? '#22c55e' : status === 'active' ? agent.color : '#475569'}
                fontFamily="JetBrains Mono, monospace"
                style={{ userSelect: 'none' }}
              >
                {status === 'complete' ? '✓ DONE' : status === 'active' ? '● RUNNING' : '○ IDLE'}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ── Flow Details button ── */}
      <button
        onClick={() => setPanelOpen(p => !p)}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          background: panelOpen ? 'rgba(14,165,233,0.22)' : 'rgba(15,22,41,0.92)',
          border: '1px solid var(--accent-blue)',
          borderRadius: 20,
          color: 'var(--accent-blue)',
          fontSize: '0.72rem',
          fontFamily: 'JetBrains Mono, monospace',
          padding: '7px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          zIndex: 10,
          backdropFilter: 'blur(10px)',
          transition: 'all 0.2s',
          boxShadow: panelOpen ? '0 0 14px rgba(14,165,233,0.3)' : 'none',
        }}
      >
        <span>ℹ</span>
        {panelOpen ? 'Hide Details' : 'Flow Details'}
      </button>

      {/* ── Detail panel ── */}
      {panelOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            right: 20,
            width: 300,
            maxHeight: '60vh',
            overflowY: 'auto',
            background: '#0f1629',
            border: '1px solid #1e2d4a',
            borderRadius: 10,
            padding: 16,
            zIndex: 20,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            animation: 'flowFadeIn 0.2s ease forwards',
          }}
        >
          {selectedAgent ? (
            /* ─ Selected agent detail ─ */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: '1.3rem' }}>{selectedAgent.icon}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedAgent.color, fontFamily: 'JetBrains Mono, monospace' }}>
                  {selectedAgent.id}
                </span>
                <button
                  onClick={() => setSelectedAgent(null)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.65, marginBottom: 12 }}>
                {selectedAgent.description}
              </p>
              {(() => {
                const ev = agentEvents.find(e => e.type === 'AGENT_COMPLETE' && e.agent === selectedAgent.id);
                if (!ev) return (
                  <div style={{ fontSize: '0.68rem', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                    No output yet — agent has not completed.
                  </div>
                );
                return (
                  <div style={{ padding: '10px 12px', background: `${selectedAgent.color}14`, border: `1px solid ${selectedAgent.color}40`, borderRadius: 7 }}>
                    <div style={{ fontSize: '0.6rem', color: '#475569', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Live Output
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#e2e8f0', lineHeight: 1.55 }}>
                      {ev.summary}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            /* ─ Pipeline overview ─ */
            <>
              <div style={{ fontSize: '0.68rem', color: '#475569', fontFamily: 'JetBrains Mono, monospace', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Pipeline Overview
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: 12 }}>
                Seven specialized agents run sequentially. Each passes structured output to the next, progressively building a complete contamination diagnosis.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {EDGES.map(e => {
                  const fromAgent = AGENTS.find(a => a.id === e.from);
                  const toAgent   = AGENTS.find(a => a.id === e.to);
                  const active    = edgeActive(e.from);
                  return (
                    <div key={`${e.from}-${e.to}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace', opacity: active ? 1 : 0.45 }}>
                      <span style={{ color: fromAgent.color }}>{fromAgent.shortLabel}</span>
                      <span style={{ color: '#1e2d4a', flex: 'none' }}>──</span>
                      <span style={{ color: active ? '#94a3b8' : '#475569', flex: 1 }}>{e.label}</span>
                      <span style={{ color: '#1e2d4a', flex: 'none' }}>→</span>
                      <span style={{ color: toAgent.color }}>{toAgent.shortLabel}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #1e2d4a', fontSize: '0.65rem', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                Click any node to inspect its role and live output.
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes flowPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes flowFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
