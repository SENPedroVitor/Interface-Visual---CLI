import React, { useRef } from 'react';
import { IconBot, IconUsers, IconSave, IconDownload } from './Icons';
import { User } from 'lucide-react';
import './GlobalActionMenu.css';

export interface GlobalActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNewBot: () => void;
  onNewGroup: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onOpenUserConfig?: () => void;
  anchorRect?: DOMRect | null;
}

export const GlobalActionMenu: React.FC<GlobalActionMenuProps> = ({
  isOpen,
  onClose,
  onNewBot,
  onNewGroup,
  onExportBackup,
  onImportBackup,
  onOpenUserConfig,
  anchorRect,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const top = anchorRect ? anchorRect.bottom + 8 : 60;
  const left = anchorRect ? Math.max(12, anchorRect.left) : 16;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
      onClose();
    }
  };

  return (
    <>
      <div className="global-menu-overlay" onClick={onClose} />
      <div className="global-menu-popup" style={{ top, left }}>
        <button
          className="global-menu-item action-primary"
          onClick={() => {
            onClose();
            onNewBot();
          }}
        >
          <span className="menu-icon"><IconBot size={16} /></span>
          <span>Novo Bot (Studio)</span>
          <span className="global-menu-badge">PRO</span>
        </button>

        <button
          className="global-menu-item action-group"
          onClick={() => {
            onClose();
            onNewGroup();
          }}
        >
          <span className="menu-icon"><IconUsers size={16} /></span>
          <span>Novo Grupo / Squad</span>
        </button>

        {onOpenUserConfig && (
          <button
            className="global-menu-item"
            onClick={() => {
              onClose();
              onOpenUserConfig();
            }}
          >
            <span className="menu-icon"><User size={16} /></span>
            <span>Meu Perfil</span>
          </button>
        )}

        <div className="global-menu-divider" />

        <button
          className="global-menu-item"
          onClick={() => {
            onClose();
            onExportBackup();
          }}
        >
          <span className="menu-icon"><IconSave size={16} /></span>
          <span>Exportar Backup</span>
        </button>

        <button
          className="global-menu-item"
          onClick={() => {
            fileInputRef.current?.click();
          }}
        >
          <span className="menu-icon"><IconDownload size={16} /></span>
          <span>Importar Backup</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </>
  );
};

export default GlobalActionMenu;
