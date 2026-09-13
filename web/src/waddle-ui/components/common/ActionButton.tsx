import React from 'react';
import { ActionButtonProps } from '../../types.ts';
import { actionRouter } from '../../actions.ts';

export const ActionButton: React.FC<ActionButtonProps> = ({
  action,
  payload,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick,
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled || loading) return;

    actionRouter.dispatch(action, payload);
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      type="button"
      className={`wui-btn wui-btn-${variant} wui-btn-${size}`}
      onClick={handleClick}
      disabled={disabled || loading}
      data-action={action}
    >
      {loading && <span className="wui-spinner" />}
      {children}
    </button>
  );
};
