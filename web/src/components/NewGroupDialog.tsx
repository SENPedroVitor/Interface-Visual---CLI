import React, { useState } from 'react';
import { Agent } from '../types';
import { WaddleAvatar } from './WaddleAvatar';
import { agentVisual } from '../utils/agentVisuals';
import { VectorIcon, IconClose } from './Icons';
import './NewGroupDialog.css';

export interface NewGroupDialogProps {
  isOpen: boolean;
  agents: Agent[];
  onClose: () => void;
  onCreated: (group: any) => void;
}

const ICONS = ['users', 'flag', 'rocket', 'shield', 'chart', 'zap', 'microscope', 'code', 'target'];

export const NewGroupDialog: React.FC<NewGroupDialogProps> = ({
  isOpen,
  agents,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('users');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['Quinta', 'Nero']);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const toggleMember = (agentName: string) => {
    setSelectedMembers(prev =>
      prev.includes(agentName) ? prev.filter(n => n !== agentName) : [...prev, agentName]
    );
  };

  const handleCreate = async () => {
    setErrorMsg('');
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg('Informe o nome do grupo.');
      return;
    }
    if (selectedMembers.length === 0) {
      setErrorMsg('Selecione pelo menos um bot para compor o grupo.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim(),
          members: selectedMembers,
          avatar_icon: icon,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao criar grupo.');
      }

      const created = await res.json();
      onCreated(created);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao criar o grupo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="group-dialog-overlay" onClick={onClose}>
      <div className="group-dialog-modal" onClick={e => e.stopPropagation()}>
        <div className="group-dialog-header">
          <h3 className="group-dialog-title">Criar Novo Grupo / Squad</h3>
          <button
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            onClick={onClose}
            title="Fechar"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="group-dialog-body">
          {errorMsg && (
            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '0.8rem' }}>
              {errorMsg}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Ícone do Grupo
            </label>
            <div className="group-icon-picker">
              {ICONS.map(ic => (
                <button
                  key={ic}
                  type="button"
                  className={`group-icon-btn ${icon === ic ? 'active' : ''}`}
                  onClick={() => setIcon(ic)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <VectorIcon name={ic} size={18} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Nome do Squad
            </label>
            <input
              type="text"
              className="studio-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Chapéus de Palha, Equipe Core, B3 Traders..."
              maxLength={64}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Descrição do Grupo
            </label>
            <input
              type="text"
              className="studio-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Squad focado em desenvolvimento e deploy automatizado."
              maxLength={240}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Membros do Squad ({selectedMembers.length} selecionados)
            </label>
            <div className="group-members-list">
              {agents.map(ag => {
                const isChecked = selectedMembers.includes(ag.name);
                const vis = agentVisual(ag.name, ag.role, ag);
                return (
                  <div
                    key={ag.id}
                    className={`group-member-item ${isChecked ? 'selected' : ''}`}
                    onClick={() => toggleMember(ag.name)}
                  >
                    <div className="group-member-left">
                      <WaddleAvatar
                        color={vis.color}
                        marking={vis.marking}
                        cosmetics={vis.cosmetics}
                        imageUrl={vis.imageUrl}
                        size={28}
                      />
                      <div>
                        <div className="group-member-name">{ag.name}</div>
                        <div className="group-member-role">{ag.role}</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ accentColor: '#a855f7' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="group-dialog-footer">
          <button className="studio-cancel-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="studio-save-btn"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? 'Criando...' : 'Criar Squad'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewGroupDialog;
