import React from 'react';
import { PortfolioCardProps } from '../../types.ts';
import { ActionButton } from '../common/ActionButton.tsx';

export const PortfolioCard: React.FC<PortfolioCardProps> = ({
  title = 'Resumo da Carteira',
  totalBalance = 'R$ 0,00',
  dailyChange = '+0,00',
  dailyPercent = '+0.0%',
  assets = [],
  onAction,
}) => {
  return (
    <div className="wui-card wui-animate-in">
      <div className="wui-card-header">
        <div className="wui-card-title-group">
          <span style={{ fontSize: '15px' }}>💼</span>
          <span className="wui-card-title">{title}</span>
        </div>
        <span className="wui-pill is-done">{dailyPercent} hoje</span>
      </div>

      <div className="wui-card-body">
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', color: 'var(--wui-text-muted)' }}>Patrimônio Total</span>
          <div style={{ fontSize: '26px', fontWeight: 800 }}>{totalBalance}</div>
          <div style={{ fontSize: '12px', color: 'var(--wui-success)', marginTop: '2px' }}>
            ▲ {dailyChange} ({dailyPercent})
          </div>
        </div>

        {assets.length > 0 && (
          <div className="wui-task-list">
            {assets.map((asset, i) => (
              <div key={i} className="wui-task-item">
                <div className="wui-task-left">
                  <strong style={{ fontSize: '13px' }}>{asset.symbol}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--wui-text-muted)' }}>{asset.allocation}</span>
                </div>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{asset.balance}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="wui-card-footer">
        <ActionButton
          action="stock.chart"
          payload={{ title }}
          variant="secondary"
          size="sm"
          onClick={() => onAction?.('stock.chart', { title })}
        >
          Extrato Detalhado
        </ActionButton>
      </div>
    </div>
  );
};
