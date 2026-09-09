import React, { useEffect, useRef, useState } from 'react';
import { Agent } from '../types';
import { createAgent } from '../services/api';
import { WaddleAvatar } from './WaddleAvatar';
import { agentVisual } from '../utils/agentVisuals';
import { roleLabel } from '../utils/agentState';

export function NewAgentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (agent: Agent) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Research');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const visual = agentVisual(name, role);
  useEffect(() => {
    dialog.current?.showModal();
    window.requestAnimationFrame(() => nameInput.current?.focus());
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try { onCreated(await createAgent({ name: name.trim(), role, description })); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível criar o agente.'); }
    finally { setSaving(false); }
  };
  return <dialog ref={dialog} className="agent-dialog" aria-labelledby="new-agent-title" onCancel={onClose} onClose={onClose}>
    <form onSubmit={submit}>
      <div className="agent-dialog-heading"><h2 id="new-agent-title">Um novo integrante</h2><button type="button" className="panel-icon-btn" onClick={onClose} aria-label="Fechar">×</button></div>
      <div className="agent-dialog-preview"><WaddleAvatar size={88} color={visual.color} marking={visual.marking} /><span>{name.trim() || 'Seu novo agente'}<small>{roleLabel(role)}</small></span></div>
      <label>Nome<input ref={nameInput} required maxLength={32} value={name} onChange={e => setName(e.target.value)} placeholder="Como ele se chama?" /></label>
      <label>Função<select value={role} onChange={e => setRole(e.target.value)}>{['Research', 'Developer', 'Reviewer', 'Executor'].map(value => <option key={value} value={value}>{roleLabel(value)}</option>)}</select></label>
      <label>Descrição<textarea maxLength={240} value={description} onChange={e => setDescription(e.target.value)} placeholder="Qual será a responsabilidade dele?" rows={2} /></label>
      <p className="agent-dialog-note">O agente usará as ferramentas locais do Waddle. A integração com um modelo de IA ainda está em desenvolvimento.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="agent-dialog-actions"><button type="button" className="quick-action-btn" onClick={onClose}>Cancelar</button><button className="primary-action" disabled={saving || !name.trim()}>{saving ? 'Criando…' : 'Criar agente'}</button></div>
    </form>
  </dialog>;
}
