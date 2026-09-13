import React from 'react';
import { MetricCardProps } from '../../types.ts';

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  change,
  trend = 'neutral',
  period,
  badge,
}) => {
  return (
    <div className="wui-metric-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="wui-metric-label">{label}</div>
        {badge && <span className="wui-pill is-pending" style={{ fontSize: '10px' }}>{badge}</span>}
      </div>
      <div className="wui-metric-val">{value}</div>
      {(change !== undefined || period) && (
        <div className={`wui-metric-trend ${trend === 'up' ? 'wui-trend-up' : trend === 'down' ? 'wui-trend-down' : ''}`}>
          {trend === 'up' && '▲ '}
          {trend === 'down' && '▼ '}
          {change !== undefined && <span>{change}</span>}
          {period && <span style={{ color: 'var(--wui-text-muted)', marginLeft: '4px' }}>· {period}</span>}
        </div>
      )}
    </div>
  );
};
