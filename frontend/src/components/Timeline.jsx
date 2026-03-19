import React, { useState, useEffect } from 'react';

export default function Timeline({ isComplete, aiTime = '2 min 17 sec', manualTime = '4-8 hours' }) {
  const [aiBarWidth, setAiBarWidth] = useState(0);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        setAiBarWidth(5); // Visually represents ~2 min 17 sec vs 4-8 hours
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setAiBarWidth(0);
    }
  }, [isComplete]);

  return (
    <div className="timeline-bar">
      <div className="timeline-label">Investigation Time:</div>

      <div className="timeline-track">
        <div className="timeline-bg">
          {/* Manual time (full width background) */}
          <div className="timeline-manual" />
          {/* AI time (animated narrow bar) */}
          <div
            className="timeline-ai"
            style={{ width: `${aiBarWidth}%` }}
          />
        </div>
        <div className="timeline-legends">
          <div className="timeline-legend-item">
            <div className="timeline-legend-dot" style={{ background: 'linear-gradient(90deg, #22c55e, #0ea5e9)' }} />
            <span>AI: {isComplete ? aiTime : '—'}</span>
          </div>
          <div className="timeline-legend-item">
            <div className="timeline-legend-dot" style={{ background: 'rgba(239,68,68,0.5)' }} />
            <span>Manual: {manualTime}</span>
          </div>
        </div>
      </div>

      <div className="timeline-stats">
        <div className="timeline-ai-time">
          {isComplete ? aiTime : '—'}
        </div>
        <div className="timeline-vs">vs manual</div>
        <div className="timeline-manual-time">{manualTime}</div>
      </div>
    </div>
  );
}
