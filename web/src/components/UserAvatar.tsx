import React from 'react';
import { User } from 'lucide-react';
import './UserAvatar.css';

export interface UserAvatarProps {
  name?: string;
  color?: string;
  imageUrl?: string;
  size?: number;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name = 'Você',
  color = '#6366f1',
  imageUrl,
  size = 32,
  className = '',
}) => {
  const getInitials = (str: string) => {
    const parts = str.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);
  const fontSize = Math.max(10, Math.round(size * 0.38));

  if (imageUrl) {
    return (
      <div
        className={`user-avatar-root ${className}`}
        style={{ width: size, height: size }}
      >
        <img src={imageUrl} alt={name} className="user-avatar-photo" />
      </div>
    );
  }

  return (
    <div
      className={`user-avatar-root user-avatar-placeholder ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: `${fontSize}px`,
      }}
      title={name}
    >
      {initials ? (
        <span className="user-avatar-text">{initials}</span>
      ) : (
        <User size={Math.round(size * 0.55)} />
      )}
    </div>
  );
};

export default UserAvatar;
