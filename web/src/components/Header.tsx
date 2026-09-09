import React from 'react';
import { IconPenguin, IconStop } from './Icons';

interface HeaderProps {
  systemStatus: 'active' | 'stopped';
  isConnected: boolean;
  onKillSwitch: () => void;
  isTriggeringKillSwitch: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  systemStatus,
  isConnected,
  onKillSwitch,
  isTriggeringKillSwitch,
}) => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconPenguin size={22} />
        </div>
        <div className="brand-info">
          <h1>WADDLE AGENT OS</h1>
          <div className="brand-subtitle">Plataforma Multiagente Autônoma Local</div>
        </div>
      </div>

      <div className="header-actions">
        <div
          className="connection-badge"
          style={{
            borderColor: systemStatus === 'active' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            color: systemStatus === 'active' ? '#34d399' : '#f87171',
          }}
        >
          <span>{systemStatus === 'active' ? '● RUNTIME ATIVO' : '■ RUNTIME STOPPED'}</span>
        </div>

        <div className="connection-badge" title={isConnected ? 'Conectado ao Backend' : 'Desconectado'}>
          <span className={`status-dot ${isConnected ? 'online' : 'offline'} ${isConnected ? 'animate-pulse' : ''}`} />
          <span>{isConnected ? 'STREAM CONECTADO' : 'OFFLINE'}</span>
        </div>

        <button
          className="btn-kill-switch"
          onClick={onKillSwitch}
          disabled={isTriggeringKillSwitch}
          title="Parada de Emergência: cancela todas as tarefas e para agentes"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><IconStop size={14} /></span>
          <span>{isTriggeringKillSwitch ? 'PARANDO...' : 'STOP ALL'}</span>
        </button>
      </div>
    </header>
  );
};
