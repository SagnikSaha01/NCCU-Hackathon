import React, { useRef, useEffect } from 'react';

const AGENT_COLORS = {
  SensorCoordinator: '#0ea5e9',
  PhysicsAgent:      '#8b5cf6',
  PatternAgent:      '#f59e0b',
  CorrelationAgent:  '#ec4899',
  VerificationAgent: '#14b8a6',
  SeverityAgent:     '#ef4444',
  ResponseAgent:     '#22c55e',
};

function getAgentColor(agent) {
  return AGENT_COLORS[agent] || '#0ea5e9';
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AgentFeed({ agentEvents = [], isInvestigating = false }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agentEvents]);

  if (agentEvents.length === 0) {
    return (
      <div className="agent-feed">
        <div className="agent-empty">
          <div className="agent-empty-icon">🤖</div>
          <div className="agent-empty-text">
            Select a scenario to begin<br />the multi-agent investigation.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-feed">
      {agentEvents.map((event, idx) => {
        const isThinking = event.type === 'AGENT_START';
        const isComplete = event.type === 'AGENT_COMPLETE';
        const agentColor = getAgentColor(event.agent);

        return (
          <div
            key={idx}
            className={`agent-item fade-in ${isThinking ? 'thinking' : 'complete'}`}
          >
            <div className="agent-item-header">
              {isThinking && (
                <span className="agent-spinner spin" style={{ color: agentColor }}>⟳</span>
              )}
              <span className="agent-name" style={{ color: agentColor }}>
                {event.agent}
              </span>
              <span className={`agent-status ${isThinking ? 'thinking' : 'complete'}`}>
                {isThinking ? 'THINKING' : 'COMPLETE'}
              </span>
              <span className="agent-timestamp">
                {formatTime(event.timestamp)}
              </span>
            </div>

            {isThinking && (
              <div className="agent-message">{event.message}</div>
            )}

            {isComplete && event.summary && (
              <div className="agent-summary">{event.summary}</div>
            )}
          </div>
        );
      })}

      {isInvestigating && (
        <div className="agent-item thinking fade-in">
          <div className="agent-item-header">
            <span className="agent-spinner spin" style={{ color: '#0ea5e9' }}>⟳</span>
            <span className="agent-name" style={{ color: '#0ea5e9' }}>System</span>
            <span className="agent-status thinking">RUNNING</span>
          </div>
          <div className="agent-message">Investigation in progress...</div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
