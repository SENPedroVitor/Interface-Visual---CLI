import React, { useMemo, useState } from 'react';
import { ProviderInfo, ToolInfo } from '../types';
import { IconClose, VectorIcon } from './Icons';
import './PluginsModal.css';

interface PluginsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools: ToolInfo[];
  providers: ProviderInfo[];
}

const PROVIDER_ICON: Record<string, string> = { ollama: 'llama', codex: 'code', claude: 'claude' };

function toolCategory(name: string): string {
  if (name.startsWith('stock_')) return 'Mercado Financeiro';
  if (name.startsWith('sports_')) return 'Esportes';
  if (name === 'run_command') return 'Terminal & Shell';
  return 'Arquivos';
}

function toolIcon(name: string): string {
  if (name.startsWith('stock_')) return 'chart';
  if (name.startsWith('sports_')) return 'trophy';
  return name;
}

function providerStatus(p: ProviderInfo): { label: string; cls: string } {
  if (p.available) return { label: 'Pronto', cls: 'available' };
  if (p.installed) return { label: 'Instalado', cls: 'installed' };
  return { label: 'Faltando', cls: 'missing' };
}

/**
 * Real inventory of what this Waddle install can actually do — the
 * registered tools (from /api/tools) and detected engines (from
 * /api/providers) — browsable Grok-Bot-plugin-marketplace style. There is
 * no install backend here, so cards show real status instead of a fake
 * "Add" button: nothing is invented.
 */
export const PluginsModal: React.FC<PluginsModalProps> = ({ isOpen, onClose, tools, providers }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');

  const categories = useMemo(() => {
    const set = new Set<string>(['Todos', 'Motores de IA']);
    tools.forEach((t) => set.add(toolCategory(t.name)));
    return Array.from(set);
  }, [tools]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();
  const matches = (name: string, desc: string) => !q || name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);

  const filteredProviders =
    category === 'Todos' || category === 'Motores de IA' ? providers.filter((p) => matches(p.name, p.detail || '')) : [];

  const filteredTools = tools.filter(
    (t) => (category === 'Todos' || toolCategory(t.name) === category) && matches(t.name, t.description)
  );

  const installedCount = providers.filter((p) => p.available).length + tools.length;

  return (
    <div className="plugins-overlay" onClick={onClose}>
      <div className="plugins-modal" onClick={(e) => e.stopPropagation()}>
        <div className="plugins-header">
          <div>
            <h2>Plugins</h2>
            <p className="plugins-subtitle">{installedCount} ativos neste Waddle local</p>
          </div>
          <button className="btn-dev-close" onClick={onClose} title="Fechar">
            <IconClose size={18} />
          </button>
        </div>

        <div className="plugins-search-row">
          <div className="search-input-wrap" style={{ flex: 1 }}>
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              className="search-input"
              placeholder="Buscar plugins"
              aria-label="Buscar plugins"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="plugins-category-row">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`plugins-chip ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="plugins-body">
          {filteredProviders.length > 0 && (
            <section className="plugins-section">
              <div className="plugins-section-title">Motores de IA</div>
              <div className="plugins-grid">
                {filteredProviders.map((p) => {
                  const status = providerStatus(p);
                  return (
                    <div className="plugin-card" key={p.id}>
                      <div className="plugin-card-icon">
                        <VectorIcon name={PROVIDER_ICON[p.id] || 'bot'} size={20} />
                      </div>
                      <div className="plugin-card-info">
                        <div className="plugin-card-name">{p.name}</div>
                        <div className="plugin-card-desc">{p.detail}</div>
                      </div>
                      <span className={`dev-provider-status ${status.cls}`}>{status.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {filteredTools.length > 0 && (
            <section className="plugins-section">
              <div className="plugins-section-title">Ferramentas</div>
              <div className="plugins-grid">
                {filteredTools.map((t) => (
                  <div className="plugin-card" key={t.name}>
                    <div className="plugin-card-icon">
                      <VectorIcon name={toolIcon(t.name)} size={20} />
                    </div>
                    <div className="plugin-card-info">
                      <div className="plugin-card-name">{t.name}</div>
                      <div className="plugin-card-desc">{t.description}</div>
                    </div>
                    <span className={`dev-tool-risk ${t.risk_level.toUpperCase()}`}>{t.risk_level}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {filteredProviders.length === 0 && filteredTools.length === 0 && (
            <p className="dev-empty">Nenhum plugin encontrado.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PluginsModal;
