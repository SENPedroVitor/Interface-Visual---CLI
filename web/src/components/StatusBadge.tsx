import React, { forwardRef } from 'react';
import { cn } from '../lib/utils';
import './StatusBadge.css';

export type StatusBadgeVariant =
  | 'success'
  | 'away'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral';

export type StatusBadgeSize = 'sm' | 'md' | 'lg';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusBadgeVariant;
  size?: StatusBadgeSize;
  pulse?: boolean;
  label?: React.ReactNode;
  isPill?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Maps an agent's internal lifecycle status to the corresponding StatusBadge visual config.
 */
export function getAgentStatusBadge(status?: string): {
  variant: StatusBadgeVariant;
  label: string;
  dotPulse: boolean;
} {
  switch (status) {
    case 'working':
      return { variant: 'away', label: 'Trabalhando', dotPulse: true };
    case 'thinking':
      return { variant: 'away', label: 'Pensando', dotPulse: true };
    case 'waiting':
      return { variant: 'away', label: 'Aguardando', dotPulse: true };
    case 'blocked':
      return { variant: 'danger', label: 'Bloqueado', dotPulse: false };
    case 'stopped':
      return { variant: 'danger', label: 'Offline', dotPulse: false };
    case 'done':
      return { variant: 'success', label: 'Disponível', dotPulse: false };
    case 'idle':
    default:
      return { variant: 'success', label: 'Online', dotPulse: false };
  }
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  (
    {
      variant = 'success',
      size = 'md',
      pulse,
      label,
      isPill = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    // Pulse is active if explicitly requested, or by default when in away/working state
    const shouldPulse = pulse !== undefined ? pulse : variant === 'away';
    const displayContent = children ?? label;

    return (
      <span
        ref={ref}
        role="status"
        aria-label={typeof displayContent === 'string' ? displayContent : variant}
        data-slot="status-badge"
        data-variant={variant}
        data-size={size}
        className={cn(
          'status-badge-root',
          isPill && 'is-pill',
          className
        )}
        {...props}
      >
        <span className="status-badge-dot-wrapper">
          {shouldPulse && <span className="status-badge-ping" />}
          <span className="status-badge-dot" />
        </span>
        {displayContent && (
          <span className="status-badge-label">{displayContent}</span>
        )}
      </span>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export default StatusBadge;
