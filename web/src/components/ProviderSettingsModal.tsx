import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, Plus, Server, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  deleteProviderCredential,
  fetchProviderCredentials,
  saveProviderCredential,
  testProviderCredential,
} from '../services/api';
import { ProviderCredential } from '../types';
import './ProviderSettingsModal.css';

interface ProviderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDER_OPTIONS = [
  { id: 'openai', label: 'OpenAI / Codex' },
  { id: 'anthropic', label: 'Anthropic / Claude' },
  { id: 'google', label: 'Google Gemini' },
  { id: 'ollama', label: 'Ollama (local)' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'custom', label: 'Outro provedor' },
];

type FormState = { provider: string; customProvider: string; name: string; apiKey: string; model: string; baseUrl: string };
const EMPTY_FORM: FormState = { provider: 'openai', customProvider: '', name: '', apiKey: '', model: '', baseUrl: '' };

export const ProviderSettingsModal: React.FC<ProviderSettingsModalProps> = ({ isOpen, onClose }) => {
  const [credentials, setCredentials] = useState<ProviderCredential[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCredentials = async () => {
    setIsLoading(true);
    setError('');
    try {
      setCredentials(await fetchProviderCredentials());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar as integrações.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsAdding(false);
      setForm(EMPTY_FORM);
      setNotice('');
      void loadCredentials();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const handleProviderChange = (provider: string) => {
    const defaults: Record<string, string> = {
      openrouter: 'https://openrouter.ai/api/v1',
      google: 'https://generativelanguage.googleapis.com/v1beta/openai',
    };
    setForm((current) => ({ ...current, provider, baseUrl: defaults[provider] || '' }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || (form.provider !== 'ollama' && !form.apiKey.trim())) return;
    setBusyId('new');
    setError('');
    setNotice('');
    try {
      await saveProviderCredential({
        provider: (form.provider === 'custom' ? form.customProvider : form.provider).trim(),
        name: form.name.trim(),
        api_key: form.apiKey,
        model: form.model.trim() || undefined,
        base_url: form.baseUrl.trim() || undefined,
      });
      // Clear the secret immediately. It never goes to localStorage/sessionStorage.
      setForm(EMPTY_FORM);
      setIsAdding(false);
      setNotice('Integração salva com segurança.');
      await loadCredentials();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar a integração.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (credential: ProviderCredential) => {
    if (!window.confirm(`Remover a integração “${credential.name}”?`)) return;
    setBusyId(credential.id);
    setError('');
    try {
      await deleteProviderCredential(credential.id);
      setCredentials((current) => current.filter((item) => item.id !== credential.id));
      setNotice('Integração removida.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível remover a integração.');
    } finally {
      setBusyId(null);
    }
  };

  const handleTest = async (credential: ProviderCredential) => {
    setBusyId(credential.id);
    setError('');
    setNotice('');
    try {
      const result = await testProviderCredential(credential.id);
      setNotice(result.detail || (result.ok ? 'Conexão verificada.' : 'O provedor recusou a conexão.'));
      await loadCredentials();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível testar a integração.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="provider-settings-overlay" onClick={onClose}>
      <section className="provider-settings-modal" role="dialog" aria-modal="true" aria-labelledby="provider-settings-title" onClick={(event) => event.stopPropagation()}>
        <header className="provider-settings-header">
          <div className="provider-settings-title-wrap">
            <div className="provider-settings-icon" aria-hidden="true"><KeyRound size={18} /></div>
            <div>
              <h2 id="provider-settings-title">Configurações de IA</h2>
              <p>Conecte provedores para usar modelos diferentes no Waddle.</p>
            </div>
          </div>
          <button type="button" className="provider-settings-close" onClick={onClose} aria-label="Fechar configurações"><X size={17} /></button>
        </header>

        <div className="provider-settings-body">
          <div className="provider-settings-security-note">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>A chave é enviada somente ao servidor e nunca é salva no navegador. Ela aparece apenas como máscara depois de cadastrada.</span>
          </div>

          {error && <div className="provider-settings-alert error" role="alert">{error}</div>}
          {notice && <div className="provider-settings-alert success" role="status"><CheckCircle2 size={15} />{notice}</div>}

          <div className="provider-settings-section-heading">
            <div><h3>Integrações conectadas</h3><p>As chaves ficam sob controle do backend local.</p></div>
            {!isAdding && <button type="button" className="provider-settings-add" onClick={() => { setError(''); setNotice(''); setIsAdding(true); }}><Plus size={15} />Adicionar provedor</button>}
          </div>

          {isAdding && (
            <form className="provider-settings-form" onSubmit={handleSubmit}>
              <div className="provider-settings-form-grid">
                <label>Provedor<select value={form.provider} onChange={(event) => handleProviderChange(event.target.value)}>{PROVIDER_OPTIONS.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
                {form.provider === 'custom' && <label>Identificador do provedor<input value={form.customProvider} onChange={(event) => update('customProvider', event.target.value)} placeholder="Ex.: mistral" pattern="[A-Za-z0-9_.:-]+" required /></label>}
                <label>Nome da conexão<input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Ex.: OpenAI pessoal" required maxLength={60} /></label>
                <label className="provider-settings-wide">API key<input type="password" value={form.apiKey} onChange={(event) => update('apiKey', event.target.value)} placeholder={form.provider === 'ollama' ? 'Opcional para Ollama local' : 'Cole a chave aqui'} autoComplete="new-password" required={form.provider !== 'ollama'} /></label>
                <label>Modelo (opcional)<input value={form.model} onChange={(event) => update('model', event.target.value)} placeholder="Ex.: gpt-4o-mini" /></label>
                <label>Base URL {['google', 'openrouter', 'custom'].includes(form.provider) ? '' : '(opcional)'}<input type="url" value={form.baseUrl} onChange={(event) => update('baseUrl', event.target.value)} placeholder="https://api.exemplo.com/v1" required={['google', 'openrouter', 'custom'].includes(form.provider)} /></label>
              </div>
              <div className="provider-settings-form-footer"><span>Para Ollama, deixe a API key vazia e use a Base URL local.</span><div><button type="button" className="provider-settings-secondary" onClick={() => setIsAdding(false)}>Cancelar</button><button type="submit" className="provider-settings-primary" disabled={busyId === 'new'}>{busyId === 'new' && <Loader2 size={14} className="provider-settings-spin" />}Salvar conexão</button></div></div>
            </form>
          )}

          <div className="provider-settings-list" aria-live="polite">
            {isLoading ? <div className="provider-settings-empty"><Loader2 size={20} className="provider-settings-spin" />Carregando integrações…</div> : credentials.length === 0 ? <div className="provider-settings-empty"><Server size={21} /><span>Nenhum provedor conectado ainda.</span></div> : credentials.map((credential) => (
              <article className="provider-settings-card" key={credential.id}>
                <div className="provider-settings-card-icon"><Server size={17} /></div>
                <div className="provider-settings-card-content"><div className="provider-settings-card-title"><strong>{credential.name}</strong><span>{credential.provider}</span></div><div className="provider-settings-card-meta"><code>{credential.masked_key}</code>{credential.model && <span>{credential.model}</span>}{credential.base_url && <span>{credential.base_url}</span>}</div></div>
                <div className="provider-settings-card-actions"><button type="button" className="provider-settings-test" onClick={() => void handleTest(credential)} disabled={busyId === credential.id}>{busyId === credential.id ? <Loader2 size={14} className="provider-settings-spin" /> : 'Verificar'}</button><button type="button" className="provider-settings-delete" onClick={() => void handleDelete(credential)} disabled={busyId === credential.id} aria-label={`Remover ${credential.name}`}><Trash2 size={15} /></button></div>
              </article>
            ))}
          </div>
        </div>
        <footer className="provider-settings-footer"><span>As integrações configuram o backend; agentes continuam selecionando seus próprios modelos.</span><button type="button" className="provider-settings-secondary" onClick={onClose}>Fechar</button></footer>
      </section>
    </div>
  );
};

export default ProviderSettingsModal;
