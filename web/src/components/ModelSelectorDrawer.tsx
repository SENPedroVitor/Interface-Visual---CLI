import React, { useState, useEffect } from 'react';
import { VectorIcon } from './Icons';
import './ModelSelectorDrawer.css';

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  tag?: string;
  recommended?: boolean;
}

export interface ModelSelectorProps {
  selectedProvider?: string;
  selectedModel?: string;
  selectedEffort?: string;
  onChange?: (config: { provider: string; model: string; reasoningEffort: string }) => void;
}

interface ProviderMeta {
  id: string;
  name: string;
  category: 'cloud' | 'local';
  icon: string;
  version: string;
  account?: string;
  status: 'online' | 'checking' | 'offline';
  description: string;
  defaultModels: ModelOption[];
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    category: 'local',
    icon: 'llama',
    version: 'v0.5.8',
    account: 'Local Instance',
    status: 'online',
    description: 'Servidor local privativo de inferência rápida sem custos de API.',
    defaultModels: [
      { id: 'llama3.2:latest', name: 'llama3.2:latest', tag: 'DEFAULT', description: 'Meta LLaMA 3.2 balanceado e rápido.' },
      { id: 'deepseek-r1:8b', name: 'deepseek-r1:8b', tag: 'REASONING', description: 'Modelo especializado em cadeias de raciocínio profundo.' },
      { id: 'qwen2.5-coder:7b', name: 'qwen2.5-coder:7b', tag: 'CODE', description: 'Otimizado para código, refatoração e scripts.' },
      { id: 'mistral:7b', name: 'mistral:7b', tag: 'FAST', description: 'Inferência leve para comandos rotineiros.' },
    ],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    category: 'local',
    icon: 'code',
    version: 'v0.3.4',
    account: 'Local Port 1234',
    status: 'offline',
    description: 'Servidor compatível OpenAI local para qualquer modelo GGUF.',
    defaultModels: [
      { id: 'local-model', name: 'default-local-model', tag: 'LOCAL', description: 'Modelo atualmente carregado no LM Studio.' },
    ],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    category: 'cloud',
    icon: 'claude',
    version: 'v1.4.0',
    account: 'Conectado',
    status: 'online',
    description: 'Raciocínio de fronteira, codificação de alta precisão e análise de dados.',
    defaultModels: [
      { id: 'claude-3-5-sonnet-latest', name: 'claude-3-5-sonnet', tag: 'RECOMMENDED', description: 'O modelo mais inteligente para código e raciocínio complexo.' },
      { id: 'claude-3-5-haiku-latest', name: 'claude-3-5-haiku', tag: 'FAST', description: 'Velocidade ultrarrápida para respostas instantâneas.' },
      { id: 'claude-3-opus-latest', name: 'claude-3-opus', tag: 'DEEP', description: 'Profundidade máxima para análises extensas.' },
    ],
  },
  {
    id: 'codex',
    name: 'OpenAI',
    category: 'cloud',
    icon: 'zap',
    version: 'v1.2.0',
    account: 'Configurar',
    status: 'online',
    description: 'Modelos GPT-4o e série o1 para raciocínio e execução multitarefa.',
    defaultModels: [
      { id: 'gpt-4o', name: 'gpt-4o', tag: 'OMNI', description: 'Multimodal de alta performance e rápida resposta.' },
      { id: 'o1-preview', name: 'o1-preview', tag: 'REASONING', description: 'Pensamento analítico passo a passo de alta complexidade.' },
      { id: 'gpt-4o-mini', name: 'gpt-4o-mini', tag: 'LIGHT', description: 'Econômico e ágil para tarefas diretas.' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    category: 'cloud',
    icon: 'sparkles',
    version: 'v1.5.0',
    account: 'Configurar',
    status: 'checking',
    description: 'Contexto de milhões de tokens e forte compreensão multimodal.',
    defaultModels: [
      { id: 'gemini-1.5-pro', name: 'gemini-1.5-pro', tag: '2M CONTEXT', description: 'Janela de contexto massiva e raciocínio refinado.' },
      { id: 'gemini-1.5-flash', name: 'gemini-1.5-flash', tag: 'FAST', description: 'Tempo de resposta de baixíssima latência.' },
    ],
  },
];

const EFFORT_OPTIONS = ['Default', 'Low', 'Medium', 'High', 'X-High', 'Max'] as const;

export const ModelSelectorDrawer: React.FC<ModelSelectorProps> = ({
  selectedProvider = 'ollama',
  selectedModel = 'llama3.2:latest',
  selectedEffort = 'Default',
  onChange,
}) => {
  const [currentProvider, setCurrentProvider] = useState(selectedProvider);
  const [currentModel, setCurrentModel] = useState(selectedModel);
  const [currentEffort, setCurrentEffort] = useState(selectedEffort);
  const [liveModels, setLiveModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);

  const activeProvider = PROVIDERS.find(p => p.id === currentProvider) || PROVIDERS[0];

  // Fetch live models if provider supports listing
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetch(`/api/providers/${currentProvider}/models`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!isMounted) return;
        if (data && Array.isArray(data.models) && data.models.length > 0) {
          const mapped: ModelOption[] = data.models.map((m: any) => ({
            id: m.id || m.name,
            name: m.name || m.id,
            description: m.description || `Modelo ${m.name}`,
            tag: m.tag || 'LOCAL',
          }));
          setLiveModels(mapped);
          // If current model not in live models, auto-pick first
          if (!mapped.some(m => m.id === currentModel)) {
            const first = mapped[0].id;
            setCurrentModel(first);
            onChange?.({ provider: currentProvider, model: first, reasoningEffort: currentEffort });
          }
        } else {
          setLiveModels(activeProvider.defaultModels);
        }
      })
      .catch(() => {
        if (isMounted) setLiveModels(activeProvider.defaultModels);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentProvider]);

  const handleProviderSelect = (providerId: string) => {
    setCurrentProvider(providerId);
    const p = PROVIDERS.find(x => x.id === providerId) || PROVIDERS[0];
    const newModel = p.defaultModels[0]?.id || 'default';
    setCurrentModel(newModel);
    onChange?.({ provider: providerId, model: newModel, reasoningEffort: currentEffort });
  };

  const handleModelSelect = (modelId: string) => {
    setCurrentModel(modelId);
    onChange?.({ provider: currentProvider, model: modelId, reasoningEffort: currentEffort });
  };

  const handleEffortSelect = (effort: string) => {
    setCurrentEffort(effort);
    onChange?.({ provider: currentProvider, model: currentModel, reasoningEffort: effort });
  };

  const modelsToDisplay = liveModels.length > 0 ? liveModels : activeProvider.defaultModels;

  return (
    <div className="model-selector-container">
      {/* Left Navigation Rail */}
      <div className="model-rail-sidebar">
        {/* Cloud Providers */}
        <div className="model-rail-section">
          <div className="model-rail-header">Nuvem (Cloud)</div>
          {PROVIDERS.filter(p => p.category === 'cloud').map(p => (
            <button
              key={p.id}
              className={`model-rail-item ${p.id === currentProvider ? 'active' : ''}`}
              onClick={() => handleProviderSelect(p.id)}
            >
              <div className="model-rail-item-left">
                <span className="model-rail-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <VectorIcon name={p.icon} size={15} />
                </span>
                <span>{p.name.split(' ')[0]}</span>
              </div>
              <span className={`model-rail-dot ${p.status}`} />
            </button>
          ))}
        </div>

        {/* Local Providers */}
        <div className="model-rail-section">
          <div className="model-rail-header">Local (Zero-Cost)</div>
          {PROVIDERS.filter(p => p.category === 'local').map(p => (
            <button
              key={p.id}
              className={`model-rail-item ${p.id === currentProvider ? 'active' : ''}`}
              onClick={() => handleProviderSelect(p.id)}
            >
              <div className="model-rail-item-left">
                <span className="model-rail-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <VectorIcon name={p.icon} size={15} />
                </span>
                <span>{p.name}</span>
              </div>
              <span className={`model-rail-dot ${p.status}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Right Content View */}
      <div className="model-rail-content">
        {/* Provider Header */}
        <div className="model-provider-header">
          <div className="provider-header-left">
            <div className="provider-logo-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <VectorIcon name={activeProvider.icon} size={22} />
            </div>
            <div>
              <div className="provider-title-row">
                <span className="provider-name">{activeProvider.name}</span>
                <span className="provider-version">{activeProvider.version}</span>
              </div>
              <div className="provider-desc">{activeProvider.description}</div>
            </div>
          </div>
          <div className={`provider-status-badge ${activeProvider.category === 'local' ? 'local' : ''}`}>
            {activeProvider.account}
          </div>
        </div>

        {/* Models List */}
        <div className="model-list-wrapper">
          <div className="model-list-section-title">
            <span>Modelos sugeridos para execução</span>
            {loading && <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Carregando tags...</span>}
          </div>

          {modelsToDisplay.map(m => {
            const isSelected = m.id === currentModel;
            return (
              <div
                key={m.id}
                className={`model-card-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleModelSelect(m.id)}
              >
                <div className="model-card-main">
                  <div className="model-check-circle">
                    {isSelected && (
                      <svg viewBox="0 0 24 24" fill="none">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div className="model-info-col">
                    <div className="model-name-row">
                      <span className="model-name">{m.name}</span>
                      {m.tag && <span className="model-tag">{m.tag}</span>}
                    </div>
                    {m.description && <span className="model-desc">{m.description}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reasoning Effort Section */}
        <div className="model-effort-container">
          <div className="effort-header-row">
            <span className="effort-title">Effort de Raciocínio (Reasoning Effort)</span>
            <span className="effort-subtitle">Ajusta passos de reflexão do modelo</span>
          </div>
          <div className="effort-pills-row">
            {EFFORT_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                className={`effort-pill-btn ${currentEffort === opt ? 'active' : ''}`}
                onClick={() => handleEffortSelect(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Footer Quick Switch Link */}
        <div className="model-footer-row">
          {activeProvider.category === 'cloud' ? (
            <span
              className="model-quick-link"
              onClick={() => handleProviderSelect('ollama')}
            >
              Usar um modelo local (Ollama) &gt;
            </span>
          ) : (
            <span
              className="model-quick-link"
              onClick={() => handleProviderSelect('claude')}
            >
              Alternar para provedor na nuvem (Claude/GPT) &gt;
            </span>
          )}
          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
            Latência otimizada para Waddle OS
          </span>
        </div>
      </div>
    </div>
  );
};

export default ModelSelectorDrawer;
