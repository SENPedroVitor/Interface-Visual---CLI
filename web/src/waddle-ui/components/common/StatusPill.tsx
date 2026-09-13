import React from 'react';
import { StatusPillProps } from '../../types.ts';

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  label,
  size = 'sm',
}) => {
  const displayLabel = label || status;

  return (
    <span className={`wui-pill is-${status} ${size === 'md' ? 'wui-pill-md' : ''}`}>
      <span className="wui-pill-dot" />
      <span>{displayLabel}</span>
    </span>
  );
};
