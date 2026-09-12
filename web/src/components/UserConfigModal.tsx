import React, { useState, useRef, useEffect } from 'react';
import { User, Camera, Trash2, Check, X } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import './UserConfigModal.css';

export interface UserProfile {
  name: string;
  role?: string;
  avatarColor: string;
  avatarImage?: string;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Pedro',
  role: 'Desenvolvedor',
  avatarColor: '#6366f1',
  avatarImage: undefined,
};

const USER_COLORS = [
  '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#10b981',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6',
  '#475569', '#1e293b',
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
  const [name, setName] = useState(profile.name || 'Pedro');
  const [role, setRole] = useState(profile.role || 'Desenvolvedor');
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor || '#6366f1');
  const [avatarImage, setAvatarImage] = useState<string | undefined>(profile.avatarImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(profile.name || 'Pedro');
      setRole(profile.role || 'Desenvolvedor');
      setAvatarColor(profile.avatarColor || '#6366f1');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim() || 'Usuário',
      role: role.trim() || undefined,
      avatarColor,
      avatarImage,
    });
    onClose();
  };

  return (
    <div className="user-modal-overlay" onClick={onClose}>
      <div className="user-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="user-modal-header">
          <div className="user-modal-header-left">
            <div className="user-modal-header-icon">
              <User size={18} />
            </div>
            <div>
              <h3 className="user-modal-title">Perfil do Usuário</h3>
              <p className="user-modal-subtitle">Personalize seu nome, foto e como você aparece no chat</p>
            </div>
          </div>
          <button type="button" className="user-modal-close-btn" onClick={onClose} title="Fechar">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="user-modal-body">
            {/* Profile Avatar Card */}
            <div className="user-profile-section">
              <div className="user-avatar-preview-area">
                <UserAvatar
                  name={name}
                  color={avatarColor}
                  imageUrl={avatarImage}
                  size={76}
                />
                <div className="user-avatar-actions">
                  <button
                    type="button"
                    className="user-btn-action"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={14} />
                    <span>{avatarImage ? 'Trocar foto' : 'Enviar foto de perfil'}</span>
                  </button>
                  {avatarImage && (
                    <button
                      type="button"
                      className="user-btn-action user-btn-danger"
                      onClick={() => setAvatarImage(undefined)}
                    >
                      <Trash2 size={13} />
                      <span>Remover foto</span>
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

              {!avatarImage && (
                <div className="user-color-selector">
                  <span className="user-label">Cor do Avatar (Iniciais)</span>
                  <div className="user-avatar-colors-row">
                    {USER_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`user-color-btn ${avatarColor.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setAvatarColor(c)}
                        title={`Selecionar cor ${c}`}
                      />
                    ))}
                    <div className="user-color-input-wrapper" title="Cor personalizada">
                      <input
                        type="color"
                        value={avatarColor}
                        onChange={(e) => setAvatarColor(e.target.value)}
                        className="user-color-input"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Fields */}
            <div className="user-form-group">
              <label className="user-label" htmlFor="user-name-input">
                Nome de Exibição
              </label>
              <input
                id="user-name-input"
                type="text"
                className="user-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pedro Vitor"
                maxLength={40}
                required
              />
            </div>

            <div className="user-form-group">
              <label className="user-label" htmlFor="user-role-input">
                Função / Cargo (opcional)
              </label>
              <input
                id="user-role-input"
                type="text"
                className="user-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex: Desenvolvedor, Administrador"
                maxLength={40}
              />
            </div>

            {/* Live Chat Message Preview */}
            <div className="user-chat-preview-box">
              <span className="user-preview-heading">Pré-visualização no Chat</span>
              <div className="user-preview-msg">
                <div className="user-preview-header">
                  <UserAvatar
                    name={name}
                    color={avatarColor}
                    imageUrl={avatarImage}
                    size={20}
                  />
                  <span className="user-preview-name">{name || 'Usuário'}</span>
                  {role && <span className="user-preview-role">· {role}</span>}
                </div>
                <div className="user-preview-bubble">
                  Olá equipe, vamos começar a revisão do projeto.
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="user-modal-footer">
            <button type="button" className="user-btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="user-btn-save">
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
