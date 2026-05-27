import React from 'react';
import { SessionUsage } from '../types';

interface RightPanelProps {
  usage: SessionUsage;
  model: string;
  sessionTitle: string;
}

const RightPanel: React.FC<RightPanelProps> = ({ usage, model, sessionTitle }) => {
  const ctxLimit = 32768;
  const percent = Math.min(100, Math.round((usage.total / ctxLimit) * 100));
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <aside className="right-sidebar">
      <div className="context-section">
        <h3>Context</h3>
        <svg className="usage-ring" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--bg-hover)" strokeWidth="4" />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 24 24)"
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        <div className="context-item" style={{ textAlign: 'center', marginBottom: '6px' }}>
          <span className="context-value">{usage.total.toLocaleString()}</span>{' '}
          <span style={{ fontSize: '10px' }}>tokens</span>
        </div>
        <div className="context-item" style={{ textAlign: 'center' }}>
          <span className="context-value">{percent}%</span>{' '}
          <span style={{ fontSize: '10px' }}>used</span>
        </div>
      </div>

      {usage.total > 0 && (
        <div className="context-section">
          <h3>Breakdown</h3>
          <div className="context-item-detail">
            <span className="context-item">Input</span>
            <span className="context-value">{usage.input.toLocaleString()}</span>
          </div>
          <div className="context-item-detail">
            <span className="context-item">Output</span>
            <span className="context-value">{usage.output.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="context-section">
        <h3>Model</h3>
        <div className="context-item">{model}</div>
      </div>

      <div className="context-section">
        <h3>LSP</h3>
        <div className="context-item">
          <span style={{ color: 'var(--text-muted)' }}>LSPs are disabled</span>
        </div>
      </div>

      <div className="context-section">
        <h3>Session</h3>
        <div className="context-item" style={{ fontSize: '11px', wordBreak: 'break-all' }}>
          {sessionTitle || '—'}
        </div>
      </div>
    </aside>
  );
};

export default RightPanel;
