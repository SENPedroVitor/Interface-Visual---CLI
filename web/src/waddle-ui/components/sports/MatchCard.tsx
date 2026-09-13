import React, { useState } from 'react';
import { MatchCardProps } from '../../types.ts';
import { ActionButton } from '../common/ActionButton.tsx';

export const MatchCard: React.FC<MatchCardProps> = ({
  homeTeam = 'Time Mandante',
  awayTeam = 'Time Visitante',
  homeScore,
  awayScore,
  homeLogo,
  awayLogo,
  statusText = 'Brasileirão',
  matchTime = 'Domingo · 18:00',
  league = 'Futebol',
  goals = [],
  isLive = false,
  onAction,
}) => {
  const [following, setFollowing] = useState(false);
  const [notified, setNotified] = useState(false);

  return (
    <div className="wui-card wui-animate-in">
      <div className="wui-card-header">
        <div className="wui-card-title-group">
          <span style={{ fontSize: '15px' }}>⚽</span>
          <span className="wui-card-title">{league}</span>
        </div>
        {isLive ? (
          <span className="wui-live-pulse-badge">AO VIVO · {matchTime}</span>
        ) : (
          <span className="wui-card-subtitle">{matchTime}</span>
        )}
      </div>

      <div className="wui-card-body">
        <div className="wui-match-scoreboard">
          {/* Home team */}
          <div className="wui-team-col">
            {homeLogo ? (
              <img src={homeLogo} alt={homeTeam} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--wui-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {homeTeam.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="wui-team-name">{homeTeam}</div>
          </div>

          {/* Score or VS */}
          <div className="wui-score-display">
            {homeScore !== undefined && awayScore !== undefined ? (
              <>
                <span>{homeScore}</span>
                <span style={{ fontSize: '16px', color: 'var(--wui-text-muted)' }}>×</span>
                <span>{awayScore}</span>
              </>
            ) : (
              <span style={{ fontSize: '18px', color: 'var(--wui-text-muted)', fontWeight: 600 }}>VS</span>
            )}
          </div>

          {/* Away team */}
          <div className="wui-team-col">
            {awayLogo ? (
              <img src={awayLogo} alt={awayTeam} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--wui-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {awayTeam.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="wui-team-name">{awayTeam}</div>
          </div>
        </div>

        {statusText && (
          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--wui-text-muted)', marginTop: '4px' }}>
            {statusText}
          </div>
        )}

        {/* Goals list */}
        {goals.length > 0 && (
          <div className="wui-events-list">
            {goals.map((g, idx) => (
              <div key={idx} className="wui-event-item">
                <span>⚽</span>
                <strong>{g.player}</strong>
                <span>{g.minute}'</span>
                <span style={{ color: 'var(--wui-text-faint)' }}>({g.team})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="wui-card-footer">
        {isLive ? (
          <ActionButton
            action="match.events"
            payload={{ homeTeam, awayTeam }}
            variant="secondary"
            size="sm"
            onClick={() => onAction?.('match.events', { homeTeam, awayTeam })}
          >
            Ver eventos
          </ActionButton>
        ) : (
          <>
            <ActionButton
              action="match.notify"
              payload={{ homeTeam, awayTeam, matchTime }}
              variant={notified ? 'success' : 'secondary'}
              size="sm"
              onClick={() => {
                setNotified(!notified);
                onAction?.('match.notify', { homeTeam, awayTeam, matchTime });
              }}
            >
              {notified ? '✓ Lembrete ativo' : 'Avisar 30 min antes'}
            </ActionButton>
            <ActionButton
              action="match.follow"
              payload={{ homeTeam, awayTeam }}
              variant={following ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setFollowing(!following);
                onAction?.('match.follow', { homeTeam, awayTeam });
              }}
            >
              {following ? '✓ Acompanhando' : 'Acompanhar jogo'}
            </ActionButton>
          </>
        )}
      </div>
    </div>
  );
};
