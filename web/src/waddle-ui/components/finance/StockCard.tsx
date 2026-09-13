import React, { useState } from 'react';
import { StockCardProps } from '../../types.ts';
import { ActionButton } from '../common/ActionButton.tsx';
import { MetricCard } from '../common/MetricCard.tsx';

export const StockCard: React.FC<StockCardProps> = ({
  symbol = 'ATIVO',
  price = '0,00',
  currency = 'R$',
  changePercent = 0,
  rsi,
  trend = 'Lateral',
  sma20,
  high52w,
  low52w,
  onAction,
}) => {
  const [inWatchlist, setInWatchlist] = useState(false);
  const numChange = typeof changePercent === 'string' ? parseFloat(changePercent.replace('%', '').replace(',', '.')) : changePercent;
  const isPositive = numChange >= 0;

  return (
    <div className="wui-card wui-animate-in">
      <div className="wui-card-header">
        <div className="wui-card-title-group">
          <span style={{ fontSize: '15px' }}>📈</span>
          <span className="wui-card-title">{symbol}</span>
        </div>
        <span
          className={`wui-pill ${isPositive ? 'is-done' : 'is-failed'}`}
          style={{ fontWeight: 700 }}
        >
          {isPositive ? '▲ +' : '▼ '}
          {Math.abs(numChange)}%
        </span>
      </div>

      <div className="wui-card-body">
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--wui-text-muted)' }}>Cotação Atual</span>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--wui-text)' }}>
            {currency} {price}
          </div>
        </div>

        {/* Indicators Grid */}
        <div className="wui-metric-grid">
          {rsi !== undefined && (
            <MetricCard label="RSI (14)" value={rsi} badge={Number(rsi) > 70 ? 'Sobrecomprado' : Number(rsi) < 30 ? 'Sobrevendido' : 'Neutro'} />
          )}
          {trend && (
            <MetricCard label="Tendência" value={trend} trend={trend === 'Alta' ? 'up' : trend === 'Baixa' ? 'down' : 'neutral'} />
          )}
          {sma20 !== undefined && (
            <MetricCard label="SMA 20" value={`${currency} ${sma20}`} />
          )}
          {(high52w !== undefined || low52w !== undefined) && (
            <MetricCard label="Mín / Máx 52s" value={`${low52w || '-'} / ${high52w || '-'}`} />
          )}
        </div>
      </div>

      <div className="wui-card-footer">
        <ActionButton
          action="stock.chart"
          payload={{ symbol }}
          variant="secondary"
          size="sm"
          onClick={() => onAction?.('stock.chart', { symbol })}
        >
          Ver gráfico
        </ActionButton>
        <ActionButton
          action="stock.watchlist"
          payload={{ symbol, price }}
          variant={inWatchlist ? 'success' : 'primary'}
          size="sm"
          onClick={() => {
            setInWatchlist(!inWatchlist);
            onAction?.('stock.watchlist', { symbol, price });
          }}
        >
          {inWatchlist ? '✓ Na Carteira' : 'Adicionar à carteira'}
        </ActionButton>
      </div>
    </div>
  );
};
