import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  className?: string;
}

// ---------------- Tools & Actions ----------------
export const IconWriteFile: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

export const IconReadFile: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

export const IconListDir: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const IconRunCmd: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export const IconWrench: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

// ---------------- Task Statuses ----------------
export const IconSpin: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className = 'animate-spin', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
);

export const IconCheck: React.FC<IconProps> = ({ size = 14, color = '#22c55e', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const IconLock: React.FC<IconProps> = ({ size = 14, color = '#f59e0b', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const IconAlert: React.FC<IconProps> = ({ size = 14, color = '#ef4444', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export const IconBan: React.FC<IconProps> = ({ size = 14, color = '#94a3b8', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

// ---------------- Agents, Tabs & Actions ----------------
export const IconBrain: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04z" />
  </svg>
);

export const IconZap: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const IconGear: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const IconPalette: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="13.5" cy="6.5" r=".5" fill={color} />
    <circle cx="17.5" cy="10.5" r=".5" fill={color} />
    <circle cx="8.5" cy="7.5" r=".5" fill={color} />
    <circle cx="6.5" cy="12.5" r=".5" fill={color} />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z" />
  </svg>
);

export const IconMask: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M2 10s3-3 10-3 10 3 10 3-1 9-10 9-10-9-10-9z" />
    <path d="M7 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    <path d="M17 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
  </svg>
);

export const IconSave: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

export const IconBot: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8.01" y2="16" strokeWidth="3" />
    <line x1="16" y1="16" x2="16.01" y2="16" strokeWidth="3" />
  </svg>
);

export const IconUsers: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const IconDownload: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const IconCamera: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export const IconClose: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const IconPanelCompact: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="3.5" />
    <line x1="9.5" y1="3" x2="9.5" y2="21" />
    <line x1="5.5" y1="7.5" x2="7.5" y2="7.5" strokeWidth="2.5" />
    <line x1="5.5" y1="11.5" x2="7.5" y2="11.5" strokeWidth="2.5" />
  </svg>
);


export const IconPenguin: React.FC<IconProps> = ({ size = 20, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} {...props}>
    <path d="M12 2C8.69 2 6 4.69 6 8v5c0 3.87 2.69 7 6 7s6-3.13 6-7V8c0-3.31-2.69-6-6-6zm0 16c-2.21 0-4-2.24-4-5V8c0-1.66 1.79-3 4-3s4 1.34 4 3v5c0 2.76-1.79 5-4 5zm-1-8.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1 3.5c-.83 0-1.5-.45-1.5-1h3c0 .55-.67 1-1.5 1z" />
  </svg>
);

export const IconStop: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
    <rect x="9" y="9" width="6" height="6" fill={color} stroke="none" />
  </svg>
);

export const IconDocument: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const IconPlug: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M12 22v-5" />
    <path d="M9 8V2M15 8V2" />
    <path d="M18 8a2 2 0 0 1 2 2v2a8 8 0 0 1-8 8 8 8 0 0 1-8-8v-2a2 2 0 0 1 2-2z" />
  </svg>
);

export const IconCopy: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// ---------------- Cosmetics ----------------
export const IconHat: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M2 18h20" />
    <path d="M6 18V9a6 6 0 0 1 12 0v9" />
  </svg>
);

export const IconHeadphones: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

export const IconCrown: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z" />
  </svg>
);

export const IconSwords: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
    <line x1="13" y1="19" x2="19" y2="13" />
    <line x1="16" y1="16" x2="20" y2="20" />
    <line x1="19" y1="21" x2="21" y2="19" />
  </svg>
);

export const IconGlasses: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="6" cy="14" r="4" />
    <circle cx="18" cy="14" r="4" />
    <line x1="10" y1="14" x2="14" y2="14" />
    <path d="M2 14l2-6M22 14l-2-6" />
  </svg>
);

export const IconSunglasses: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1" className={className} {...props}>
    <path d="M3 11h7l-1 5H4zM14 11h7l-1 5h-5z" />
    <path fill="none" strokeWidth="2" d="M2 11h20M10 11a2 2 0 0 0 4 0" />
  </svg>
);

export const IconTie: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <polygon points="10 2 14 2 15 5 12 7 9 5 10 2" />
    <polygon points="12 7 15 17 12 22 9 17 12 7" />
  </svg>
);

export const IconBowtie: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <polygon points="4 6 12 12 4 18 4 6" />
    <polygon points="20 6 12 12 20 18 20 6" />
    <circle cx="12" cy="12" r="2" fill={color} />
  </svg>
);

export const IconCoffee: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </svg>
);

// ---------------- Squad Badges ----------------
export const IconFlag: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

export const IconRocket: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

export const IconShield: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const IconChart: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

export const IconMicroscope: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M6 18h8" />
    <path d="M3 22h18" />
    <path d="M14 22a7 7 0 1 0 0-14h-1" />
    <path d="M9 14h2" />
    <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
    <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
  </svg>
);

export const IconCode: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

export const IconTarget: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

export const IconGlobe: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

// ---------------- Providers / LLMs ----------------
export const IconLlama: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M7 3v7l3 2v6l-2 2h8l-2-2v-8l-3-2V3z" />
    <circle cx="9" cy="5" r=".5" fill={color} />
  </svg>
);

export const IconAsterisk: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="3.34" y1="7" x2="20.66" y2="17" />
    <line x1="3.34" y1="17" x2="20.66" y2="7" />
  </svg>
);

export const IconSparkles: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

// Sports
export const IconTrophy: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34" />
    <path d="M6 4h12v5a6 6 0 0 1-12 0V4Z" />
  </svg>
);

export const IconBall: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m12 7 3.5 2.5-1.5 4h-4L8.5 9.5Z" />
    <path d="M12 7V2" />
    <path d="m15.5 9.5 4.5-1.5" />
    <path d="m14 13.5 3 3.5" />
    <path d="m10 13.5-3 3.5" />
    <path d="m8.5 9.5-4.5-1.5" />
  </svg>
);

export const IconBasketball: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2v20" />
    <path d="M4.93 4.93c4.24 4.24 4.24 10.9 0 14.14" />
    <path d="M19.07 4.93c-4.24 4.24-4.24 10.9 0 14.14" />
  </svg>
);

export const IconFootball: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <path d="M2 12C2 6.5 6.5 2 12 2c7 0 10 3 10 10 0 5.5-4.5 10-10 10C5 22 2 19 2 12Z" />
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="10" y1="14" x2="14" y2="10" />
    <line x1="8" y1="12" x2="12" y2="8" />
    <line x1="12" y1="16" x2="16" y2="12" />
  </svg>
);

export const IconBaseball: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M5.5 3a10 10 0 0 0 0 18" />
    <path d="M18.5 3a10 10 0 0 1 0 18" />
    <line x1="3" y1="8" x2="6.5" y2="9" />
    <line x1="2" y1="12" x2="5.5" y2="12" />
    <line x1="3" y1="16" x2="6.5" y2="15" />
    <line x1="21" y1="8" x2="17.5" y2="9" />
    <line x1="22" y1="12" x2="18.5" y2="12" />
    <line x1="21" y1="16" x2="17.5" y2="15" />
  </svg>
);

export const IconWhistle: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="9" cy="14" r="6" />
    <path d="M15 14h5a2 2 0 0 0 2-2V8h-6v2" />
    <path d="M9 8V4" />
    <circle cx="9" cy="14" r="2" />
  </svg>
);

// ---------------- Universal VectorIcon Dispatcher ----------------
export const VectorIcon: React.FC<{ name: string; size?: number | string; color?: string; className?: string }> = ({
  name,
  size = 16,
  color = 'currentColor',
  className,
}) => {
  switch (name) {
    // Tools
    case 'write_file':
    case 'file_system':
    case 'file':
      return <IconWriteFile size={size} color={color} className={className} />;
    case 'read_file':
    case 'book':
      return <IconReadFile size={size} color={color} className={className} />;
    case 'list_directory':
    case 'folder':
      return <IconListDir size={size} color={color} className={className} />;
    case 'run_command':
    case 'terminal_run':
    case 'terminal':
      return <IconRunCmd size={size} color={color} className={className} />;
    case 'tool':
    case 'wrench':
      return <IconWrench size={size} color={color} className={className} />;

    // Statuses
    case 'running':
    case 'spinning':
      return <IconSpin size={size} color={color} className={className} />;
    case 'completed':
    case 'check':
      return <IconCheck size={size} color={color} className={className} />;
    case 'blocked':
    case 'lock':
      return <IconLock size={size} color={color} className={className} />;
    case 'failed':
    case 'alert':
      return <IconAlert size={size} color={color} className={className} />;
    case 'cancelled':
    case 'ban':
      return <IconBan size={size} color={color} className={className} />;

    // Badges & Squads
    case 'users':
    case 'group':
    case 'squad':
      return <IconUsers size={size} color={color} className={className} />;
    case 'flag':
    case 'pirate':
      return <IconFlag size={size} color={color} className={className} />;
    case 'rocket':
      return <IconRocket size={size} color={color} className={className} />;
    case 'shield':
    case 'shield_mark':
      return <IconShield size={size} color={color} className={className} />;
    case 'chart':
    case 'stock_market':
    case 'data_grid':
    case 'data':
      return <IconChart size={size} color={color} className={className} />;
    case 'microscope':
    case 'research':
      return <IconMicroscope size={size} color={color} className={className} />;
    case 'code':
    case 'developer':
    case 'code_cursor':
      return <IconCode size={size} color={color} className={className} />;
    case 'target':
    case 'executor':
    case 'command_module':
      return <IconTarget size={size} color={color} className={className} />;
    case 'web_search':
    case 'globe':
      return <IconGlobe size={size} color={color} className={className} />;
    case 'zap':
    case 'bolt':
    case 'timeline_rig':
    case 'orbit_mark':
    case 'motion':
      return <IconZap size={size} color={color} className={className} />;
    case 'brain':
      return <IconBrain size={size} color={color} className={className} />;
    case 'gear':
    case 'signal_band':
    case 'side_panel':
    case 'operations':
      return <IconGear size={size} color={color} className={className} />;
    case 'bot':
      return <IconBot size={size} color={color} className={className} />;
    case 'save':
    case 'disk':
      return <IconSave size={size} color={color} className={className} />;
    case 'download':
      return <IconDownload size={size} color={color} className={className} />;
    case 'camera':
      return <IconCamera size={size} color={color} className={className} />;
    case 'design_nodes':
    case 'designer':
      return <IconPalette size={size} color={color} className={className} />;
    case 'close':
    case 'x':
      return <IconClose size={size} color={color} className={className} />;
    case 'penguin':
      return <IconPenguin size={size} color={color} className={className} />;
    case 'stop':
      return <IconStop size={size} color={color} className={className} />;
    case 'document':
      return <IconDocument size={size} color={color} className={className} />;
    case 'panel_compact':
    case 'sidebar_toggle':
      return <IconPanelCompact size={size} color={color} className={className} />;


    // Cosmetics
    case 'luffy_hat':
    case 'hat':
      return <IconHat size={size} color={color} className={className} />;
    case 'headphones':
      return <IconHeadphones size={size} color={color} className={className} />;
    case 'crown':
      return <IconCrown size={size} color={color} className={className} />;
    case 'zoro_scar':
    case 'swords':
      return <IconSwords size={size} color={color} className={className} />;
    case 'glasses':
      return <IconGlasses size={size} color={color} className={className} />;
    case 'sunglasses':
      return <IconSunglasses size={size} color={color} className={className} />;
    case 'tie':
      return <IconTie size={size} color={color} className={className} />;
    case 'money_tie':
      return <IconTie size={size} color="#10b981" className={className} />;
    case 'bowtie':
      return <IconBowtie size={size} color={color} className={className} />;
    case 'coffee':
      return <IconCoffee size={size} color={color} className={className} />;
    case 'whistle':
    case 'sports':
      return <IconWhistle size={size} color={color} className={className} />;
    case 'sports_headband':
      return <IconTrophy size={size} color="#3b82f6" className={className} />;
    case 'leaf_badge':
      return <IconCheck size={size} color="#10b981" className={className} />;
    case 'trophy':
    case 'champion':
      return <IconTrophy size={size} color={color} className={className} />;
    case 'ball':
    case 'soccer':
      return <IconBall size={size} color={color} className={className} />;
    case 'basketball':
    case 'nba':
      return <IconBasketball size={size} color={color} className={className} />;
    case 'football':
    case 'nfl':
      return <IconFootball size={size} color={color} className={className} />;
    case 'baseball':
    case 'mlb':
      return <IconBaseball size={size} color={color} className={className} />;

    // Providers
    case 'llama':
      return <IconLlama size={size} color={color} className={className} />;
    case 'claude':
    case 'asterisk':
      return <IconAsterisk size={size} color={color} className={className} />;
    case 'sparkles':
      return <IconSparkles size={size} color={color} className={className} />;

    default:
      return <IconBot size={size} color={color} className={className} />;
  }
};
