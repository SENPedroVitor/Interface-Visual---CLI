import React from 'react';
import { LiveScoreProps } from '../../types.ts';
import { ActionButton } from '../common/ActionButton.tsx';

export const LiveScore: React.FC<LiveScoreProps> = ({
  matchTitle,
  minute,
  score,
  events = [],
  onAction,
}) => {
  return (
    <div className="wui-card wui-animate-in">
      <div className="wui-card-header">
        <div className="wui-card-title-group">
          <span className="wui-live-pulse-badge">AO VIVO</span>
          <span className="wui-card-title">{matchTitle}</span>
        </div>
        <span style={{ fontWeight: 700, color: 'var(--wui-danger)' }}>{minute}</span>
      </div>

      <div className="wui-card-body" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '2px', margin: '6px 0' }}>
          {score}
        </div>

        {events.length > 0 && (
          <div className="wui-events-list">
            {events.map((ev, i) => (
              <div key={i} className="wui-event-item" style={{ justifyContent: 'center' }}>
                <span>
                  {ev.type === 'goal' ? '⚽' : ev.type === 'card' ? '🟨' : ev.type === 'sub' ? '🔄' : '🔍'}
                </span>
                <span>{ev.detail}</span>
                <span style={{ color: 'var(--wui-text-faint)', fontSize: '11px' }}>({ev.minute})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="wui-card-footer">
        <ActionButton
          action="match.events"
          payload={{ matchTitle }}
          variant="secondary"
          size="sm"
          onClick={() => onAction?.('match.events', { matchTitle })}
        >
          Ver todos os lances
        </ActionButton>
      </div>
    </div>
  );
};
