import React, { useEffect, useRef, useState } from 'react';
import { Agent, ProviderInfo } from '../types';
import { updateAgent } from '../services/api';
import { WaddleAvatar } from './WaddleAvatar';
import { agentVisual } from '../utils/agentVisuals';
import { roleLabel } from '../utils/agentState';

export function AgentProfileDialog({
  agent,
  providers,
  onClose,
  onSaved,
}: {
  agent: Agent;
  providers: ProviderInfo[];
  onClose: () => void;
  onSaved: (agent: Agent) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [role, setRole] = useState(agent.role);
  const [description, setDescription] = useState(agent.description || '');
  const [providerId, setProviderId] = useState(agent.provider_id || 'ollama');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const visual = agentVisual(agent.name, role);
  const isSystemAgent = ['Quinta', 'Manager', 'Worker'].includes(agent.name);

  useEffect(() => { dialog.current?.showModal(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSystemAgent) return;
    setSaving(true);
    setError('');
    try {
      onSaved(await updateAgent(agent.name, { role, description, provider_id: providerId }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialog} className="agent-dialog" aria-labelledby="agent-profile-title" onCancel={onClose} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="agent-dialog-heading">
          <h2 id="agent-profile-title">Perfil do agente</h2>
          <button type="button" className="panel-icon-btn" onClick={onClose} aria-label="Fechar">x</button>
        </div>

        <div className="agent-dialog-preview">
          <WaddleAvatar size={88} color={visual.color} marking={visual.marking} />
          <span>{agent.name}<small>{roleLabel(role)}</small></span>
        </div>

        <label>Função
          <select value={role} onChange={e => setRole(e.target.value)} disabled={isSystemAgent}>
            {['Research', 'Developer', 'Reviewer', 'Executor'].map(value => <option key={value} value={value}>{roleLabel(value)}</option>)}
          </select>
        </label>

        <label>Responsabilidade
          <textarea maxLength={240} value={description} onChange={e => setDescription(e.target.value)} rows={3} disabled={isSystemAgent} />
        </label>

        <label>Motor preferido
          <select value={providerId} onChange={e => setProviderId(e.target.value)} disabled={isSystemAgent}>
            {providers.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name} · {provider.available ? 'pronto' : provider.installed ? 'instalado' : 'faltando'}
              </option>
            ))}
          </select>
        </label>

        {isSystemAgent && <p className="agent-dialog-note">Agentes do sistema ficam bloqueados para edição direta nesta versão.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="agent-dialog-actions">
          <button type="button" className="quick-action-btn" onClick={onClose}>Fechar</button>
          {!isSystemAgent && <button className="primary-action" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>}
        </div>
      </form>
    </dialog>
  );
}
