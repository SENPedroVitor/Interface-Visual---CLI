import React, { useState, useRef, useEffect } from 'react';
import { User, Camera, Check, X } from 'lucide-react';
import { WaddleAvatar } from './WaddleAvatar';
import './UserConfigModal.css';

export interface UserProfile {
  name: string;
  avatarColor: string;
  avatarImage?: string;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Você',
  avatarColor: '#38bdf8',
  avatarImage: undefined,
};

const USER_COLORS = [
  '#38bdf8', '#9159FE', '#22c55e', '#f97316', '#ef4444', '#ec4899',
  '#eab308', '#14b8a6', '#6366f1', '#84cc16', '#06b6d4', '#1e293b',
];

interface UserConfigModalProps {
  isOpen: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSave: (newProfile: UserProfile) => void;
}

export const UserConfigModal: React.FC<UserConfigModalProps> = ({
  isOpen,
  profile,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(profile.name || 'Você');
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor || '#38bdf8');
  const [avatarImage, setAvatarImage] = useState<string | undefined>(profile.avatarImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(profile.name || 'Você');
      setAvatarColor(profile.avatarColor || '#38bdf8');
      setAvatarImage(profile.avatarImage);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatarImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorSelect = (c: string) => {
    setAvatarColor(c);
    setAvatarImage(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim() || 'Você',
      avatarColor,
      avatarImage,
    });
    onClose();
  };

  return (
    <div className="user-modal-overlay" onClick={onClose}>
      <div className="user-modal" onClick={e => e.stopPropagation()}>
        <div className="user-modal-header">
          <div className="user-modal-header-left">
            <div className="user-modal-header-icon">
              <User size={17} />
            </div>
            <h3 className="user-modal-title">Configurar Perfil</h3>
          </div>
          <button type="button" className="user-modal-close-btn" onClick={onClose} title="Fechar">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="user-modal-body">
            {/* Avatar Preview & Customization */}
            <div className="user-avatar-preview-card">
              <div className="user-avatar-preview-box">
                <WaddleAvatar
                  color={avatarColor}
                  imageUrl={avatarImage}
                  size={64}
                  interactive={true}
                  quote={`Olá, eu sou ${name || 'Você'}!`}
                />
              </div>

              <div className="user-avatar-controls">
                <span className="user-label">Cor do Mascote</span>
                <div className="user-avatar-colors-row">
                  {USER_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`user-color-btn ${avatarColor.toLowerCase() === c.toLowerCase() && !avatarImage ? 'active' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => handleColorSelect(c)}
                    />
                  ))}
                  <input
                    type="color"
                    value={avatarColor}
                    onChange={e => handleColorSelect(e.target.value)}
                    className="user-color-btn"
                    title="Cor personalizada"
                    style={{ padding: 0, border: 'none', background: 'transparent' }}
                  />
                </div>

                <div className="user-avatar-actions-row">
                  <button
                    type="button"
                    className="user-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={13} />
                    <span>{avatarImage ? 'Trocar foto' : 'Enviar foto'}</span>
                  </button>
                  {avatarImage && (
                    <button
                      type="button"
                      className="user-remove-photo-btn"
                      onClick={() => setAvatarImage(undefined)}
                    >
                      Remover foto
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageUpload}
                  />
                </div>
              </div>
            </div>

            {/* Name Input */}
            <div className="user-field-group">
              <label className="user-label" htmlFor="user-name-input">
                Seu Nome de Exibição
              </label>
              <input
                id="user-name-input"
                type="text"
                className="user-input"
                maxLength={40}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Pedro"
                required
              />
            </div>
          </div>

          <div className="user-modal-footer">
            <button type="button" className="user-cancel-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="user-save-btn">
              <Check size={14} />
              <span>Salvar Perfil</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserConfigModal;
