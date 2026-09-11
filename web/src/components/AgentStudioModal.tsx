import React, { useState, useEffect, useRef } from 'react';
import { Agent } from '../types';
import { WaddleAvatar, AvatarCosmetics, MarkingType } from './WaddleAvatar';
import { ModelSelectorDrawer } from './ModelSelectorDrawer';
import { agentVisual } from '../utils/agentVisuals';
import {
  Palette,
  X,
  Brain,
  Wrench,
  Database,
  Cpu,
  Camera,
  Check,
  Trash2,
  Plus,
  Sparkles,
  Terminal,
  FolderCode,
  TrendingUp,
  Globe,
  Crown,
  Sun,
  Headphones,
  Trophy,
  Swords,
  Glasses,
  Briefcase,
  DollarSign,
  Award,
  Leaf,
  Coffee,
  Activity,
} from 'lucide-react';
import './AgentStudioModal.css';

export interface AgentStudioModalProps {
  isOpen: boolean;
  agent?: Agent | null;
  onClose: () => void;
  onSaved: (updatedAgent: any) => void;
}

type StudioTab = 'identity' | 'soul' | 'skills' | 'memory' | 'model';

const COLOR_PALETTE = [
  '#9159FE', '#38bdf8', '#22c55e', '#f97316', '#ef4444', '#ec4899',
  '#eab308', '#14b8a6', '#6366f1', '#84cc16', '#06b6d4', '#1e293b',
];

const AVAILABLE_SKILLS = [
  { id: 'terminal_run', name: 'Terminal & CLI OS', icon: 'terminal_run', desc: 'Permite executar comandos shell, testes e scripts.' },
  { id: 'file_system', name: 'Leitura & Escrita de Arquivos', icon: 'file_system', desc: 'Acesso para inspecionar, criar e atualizar arquivos locais.' },
  { id: 'stock_market', name: 'Mercado Financeiro & B3', icon: 'stock_market', desc: 'Consultas de cotação em tempo real e indicadores técnicos da B3.' },
  { id: 'web_search', name: 'Navegador & Busca Web', icon: 'web_search', desc: 'Pesquisa e extração de conteúdo na web externa.' },
];

export const AgentStudioModal: React.FC<AgentStudioModalProps> = ({
  isOpen,
  agent,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('identity');
  const isEditing = Boolean(agent && agent.name);

  // Identity state
  const [name, setName] = useState('');
  const [role, setRole] = useState('Executor');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#9159FE');
  const [marking, setMarking] = useState<MarkingType>('none');
  const [cosmetics, setCosmetics] = useState<AvatarCosmetics>({
    head: 'none',
    face: 'none',
    body: 'none',
    hand: 'none',
  });
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

  // Soul state
  const [soulPrompt, setSoulPrompt] = useState('');
  const [whatItDoes, setWhatItDoes] = useState('');
  const [whatItDoesNot, setWhatItDoesNot] = useState('');
  const [tone, setTone] = useState('Direto e ágil');

  // Skills state
  const [skills, setSkills] = useState<string[]>(['terminal_run', 'file_system']);

  // Memory state
  const [memories, setMemories] = useState<Array<{ id: string; text: string }>>([]);
  const [newMemoryText, setNewMemoryText] = useState('');

  // Model state
  const [modelConfig, setModelConfig] = useState({
    provider: 'ollama',
    model: 'llama3.2:latest',
    reasoningEffort: 'Default',
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing agent details if editing
  useEffect(() => {
    if (!isOpen) return;

    if (agent && agent.name) {
      setName(agent.name);
      setRole(agent.role || 'Executor');
      setDescription(agent.description || '');

      const baseVis = agentVisual(agent.name, agent.role, agent.avatar_config);
      setColor(baseVis.color || '#9159FE');
      setMarking(baseVis.marking || 'none');
      if (baseVis.cosmetics) setCosmetics(baseVis.cosmetics);
      if (baseVis.imageUrl && (baseVis.imageUrl.startsWith('data:') || baseVis.imageUrl.startsWith('http'))) {
        setImageUrl(baseVis.imageUrl);
      } else {
        setImageUrl(undefined);
      }

      // Fetch deep details
      fetch(`/api/agents/${agent.name}/details`)
        .then(res => (res.ok ? res.json() : null))
        .then(details => {
          if (details) {
            if (details.soul) setSoulPrompt(details.soul);
            if (Array.isArray(details.skills)) setSkills(details.skills);
            if (Array.isArray(details.memory)) {
              setMemories(details.memory.map((m: any, idx: number) => ({
                id: m.id || String(idx),
                text: typeof m === 'string' ? m : m.fact || m.text || JSON.stringify(m),
              })));
            }
            if (details.avatar_config) {
              if (details.avatar_config.color) setColor(details.avatar_config.color);
              if (details.avatar_config.marking) setMarking(details.avatar_config.marking);
              if (details.avatar_config.cosmetics) setCosmetics(details.avatar_config.cosmetics);
              if (details.avatar_config.imageUrl && (details.avatar_config.imageUrl.startsWith('data:') || details.avatar_config.imageUrl.startsWith('http'))) {
                setImageUrl(details.avatar_config.imageUrl);
              }
            }
            if (details.model_config) {
              setModelConfig({
                provider: details.model_config.provider || details.provider_id || 'ollama',
                model: details.model_config.model || 'llama3.2:latest',
                reasoningEffort: details.model_config.reasoningEffort || 'Default',
              });
            }
          }
        })
        .catch(() => {});
    } else {
      // Reset for new bot creation
      setName('');
      setRole('Executor');
      setDescription('');
      setColor('#38bdf8');
      setMarking('none');
      setCosmetics({ head: 'luffy_hat', face: 'none', body: 'none', hand: 'coffee' });
      setImageUrl(undefined);
      setSoulPrompt('');
      setWhatItDoes('');
      setWhatItDoesNot('');
      setSkills(['terminal_run', 'file_system']);
      setMemories([]);
      setModelConfig({ provider: 'ollama', model: 'llama3.2:latest', reasoningEffort: 'Default' });
    }
  }, [isOpen, agent]);

  if (!isOpen) return null;

  const handleColorSelect = (newColor: string) => {
    setColor(newColor);
    // If a stock image was present, clear it so the vector mascot color shows immediately
    if (imageUrl && !imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
      setImageUrl(undefined);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMemory = () => {
    if (!newMemoryText.trim()) return;
    setMemories(prev => [...prev, { id: String(Date.now()), text: newMemoryText.trim() }]);
    setNewMemoryText('');
  };

  const handleDeleteMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const toggleSkill = (skillId: string) => {
    setSkills(prev =>
      prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId]
    );
  };

  const renderSkillIcon = (id: string) => {
    switch (id) {
      case 'terminal_run': return <Terminal size={18} />;
      case 'file_system': return <FolderCode size={18} />;
      case 'stock_market': return <TrendingUp size={18} />;
      case 'web_search': return <Globe size={18} />;
      default: return <Wrench size={18} />;
    }
  };

  const renderCosmeticIcon = (id: string) => {
    switch (id) {
      case 'crown': return <Crown size={14} />;
      case 'luffy_hat': return <Sun size={14} />;
      case 'headphones': return <Headphones size={14} />;
      case 'sports_headband': return <Trophy size={14} />;
      case 'zoro_scar': return <Swords size={14} />;
      case 'glasses':
      case 'sunglasses': return <Glasses size={14} />;
      case 'tie': return <Briefcase size={14} />;
      case 'money_tie': return <DollarSign size={14} />;
      case 'bowtie': return <Award size={14} />;
      case 'leaf_badge': return <Leaf size={14} />;
      case 'whistle': return <Activity size={14} />;
      case 'coffee': return <Coffee size={14} />;
      default: return null;
    }
  };

  const handleSave = async () => {
    setErrorMsg('');
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Informe o nome do bot.');
      setActiveTab('identity');
      return;
    }

    setSaving(true);
    try {
      const combinedSoul = [
        soulPrompt.trim(),
        whatItDoes.trim() ? `ESPECIALIDADES:\n${whatItDoes.trim()}` : '',
        whatItDoesNot.trim() ? `LIMITES & O QUE NÃO FAZER:\n${whatItDoesNot.trim()}` : '',
        tone ? `TOM DE VOZ: ${tone}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const avatar_config = {
        color,
        marking,
        cosmetics,
        imageUrl,
      };

      const payload = {
        name: trimmedName,
        role,
        description: description.trim(),
        provider_id: modelConfig.provider,
        soul: combinedSoul,
        skills,
        memory: memories,
        avatar_config,
        model_config: modelConfig,
      };

      let res;
      if (isEditing) {
        res = await fetch(`/api/agents/${agent!.name}/details`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao salvar bot.');
      }

      const savedData = await res.json();
      onSaved(savedData);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar o bot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="studio-overlay" onClick={onClose}>
      <div className="studio-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="studio-header">
          <div className="studio-header-title-row">
            <div className="studio-header-icon">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="studio-header-title">
                {isEditing ? `Personalizar ${agent?.name}` : 'Studio de Criação de Bot'}
              </h2>
              <p className="studio-header-subtitle">
                Configure identidade, cosméticos, alma, ferramentas e modelo de IA
              </p>
            </div>
          </div>
          <button className="studio-close-btn" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="studio-body">
          {/* Left Navigation Rail */}
          <div className="studio-tabs-rail">
            <button
              className={`studio-tab-btn ${activeTab === 'identity' ? 'active' : ''}`}
              onClick={() => setActiveTab('identity')}
            >
              <span className="tab-icon"><Palette size={16} /></span>
              <span>Identidade</span>
            </button>

            <button
              className={`studio-tab-btn ${activeTab === 'soul' ? 'active' : ''}`}
              onClick={() => setActiveTab('soul')}
            >
              <span className="tab-icon"><Brain size={16} /></span>
              <span>Alma & Regras</span>
            </button>

            <button
              className={`studio-tab-btn ${activeTab === 'skills' ? 'active' : ''}`}
              onClick={() => setActiveTab('skills')}
            >
              <span className="tab-icon"><Wrench size={16} /></span>
              <span>Habilidades</span>
            </button>

            <button
              className={`studio-tab-btn ${activeTab === 'memory' ? 'active' : ''}`}
              onClick={() => setActiveTab('memory')}
            >
              <span className="tab-icon"><Database size={16} /></span>
              <span>Memória</span>
            </button>

            <button
              className={`studio-tab-btn ${activeTab === 'model' ? 'active' : ''}`}
              onClick={() => setActiveTab('model')}
            >
              <span className="tab-icon"><Cpu size={16} /></span>
              <span>Modelo & IA</span>
            </button>
          </div>

          {/* Right Tab Content */}
          <div className="studio-content-area">
            {errorMsg && (
              <div className="studio-error-banner">
                {errorMsg}
              </div>
            )}

            {/* TAB 1: IDENTIDADE */}
            {activeTab === 'identity' && (
              <div className="studio-section">
                {/* Live Mascot Avatar Preview Card */}
                <div className="identity-preview-card">
                  <div className="preview-avatar-box">
                    <WaddleAvatar
                      color={color}
                      marking={marking}
                      cosmetics={cosmetics}
                      imageUrl={imageUrl}
                      size={96}
                      interactive={true}
                      quote="Pronto para o trabalho!"
                    />
                    <span className="avatar-hint">Clique para pular</span>
                  </div>

                  <div className="preview-controls-box">
                    <div className="preview-controls-header">
                      <span className="studio-label">Cores do Mascote</span>
                      {imageUrl && (
                        <button
                          type="button"
                          className="remove-photo-btn"
                          onClick={() => setImageUrl(undefined)}
                        >
                          Remover foto e usar mascote
                        </button>
                      )}
                    </div>
                    <div className="identity-colors-grid">
                      {COLOR_PALETTE.map(c => (
                        <button
                          key={c}
                          type="button"
                          className={`color-swatch-btn ${color.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => handleColorSelect(c)}
                        />
                      ))}
                      <input
                        type="color"
                        value={color}
                        onChange={e => handleColorSelect(e.target.value)}
                        className="color-custom-input"
                        title="Cor personalizada"
                      />
                    </div>

                    <div style={{ marginTop: '6px' }}>
                      <button
                        type="button"
                        className="cosmetic-pill-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera size={14} />
                        <span>Enviar Foto Personalizada</span>
                      </button>
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

                {/* Cosmetics Categories */}
                <div className="cosmetics-category-block">
                  <span className="studio-label">Cabeça (Head Accessory)</span>
                  <div className="cosmetics-pills-row">
                    {[
                      { id: 'none', label: 'Nenhum' },
                      { id: 'sports_headband', label: 'Faixa Esportiva' },
                      { id: 'luffy_hat', label: 'Chapéu do Luffy' },
                      { id: 'headphones', label: 'Fone de Ouvido' },
                      { id: 'crown', label: 'Coroa Real' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className={`cosmetic-pill-btn ${(cosmetics.head || 'none') === item.id ? 'active' : ''}`}
                        onClick={() => setCosmetics(prev => ({ ...prev, head: item.id }))}
                      >
                        {renderCosmeticIcon(item.id)}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cosmetics-category-block">
                  <span className="studio-label">Rosto (Face Details)</span>
                  <div className="cosmetics-pills-row">
                    {[
                      { id: 'none', label: 'Nenhum' },
                      { id: 'zoro_scar', label: 'Cicatriz do Zoro' },
                      { id: 'glasses', label: 'Óculos Nerd' },
                      { id: 'sunglasses', label: 'Óculos Escuros' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className={`cosmetic-pill-btn ${(cosmetics.face || 'none') === item.id ? 'active' : ''}`}
                        onClick={() => setCosmetics(prev => ({ ...prev, face: item.id }))}
                      >
                        {renderCosmeticIcon(item.id)}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cosmetics-category-block">
                  <span className="studio-label">Corpo & Roupa</span>
                  <div className="cosmetics-pills-row">
                    {[
                      { id: 'none', label: 'Nenhum' },
                      { id: 'money_tie', label: 'Gravata Dinheiro ($)' },
                      { id: 'whistle', label: 'Apito de Árbitro' },
                      { id: 'tie', label: 'Gravata Vermelha' },
                      { id: 'bowtie', label: 'Gravata Borboleta' },
                      { id: 'leaf_badge', label: 'Broche Eco' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className={`cosmetic-pill-btn ${(cosmetics.body || 'none') === item.id ? 'active' : ''}`}
                        onClick={() => setCosmetics(prev => ({ ...prev, body: item.id }))}
                      >
                        {renderCosmeticIcon(item.id)}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cosmetics-category-block">
                  <span className="studio-label">Mão & Acessórios</span>
                  <div className="cosmetics-pills-row">
                    {[
                      { id: 'none', label: 'Nenhum' },
                      { id: 'coffee', label: 'Café Fumegante' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className={`cosmetic-pill-btn ${(cosmetics.hand || 'none') === item.id ? 'active' : ''}`}
                        onClick={() => setCosmetics(prev => ({ ...prev, hand: item.id }))}
                      >
                        {renderCosmeticIcon(item.id)}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form fields: Name, Role, Description */}
                <div className="studio-field-group">
                  <label className="studio-label">Nome do Bot</label>
                  <input
                    type="text"
                    className="studio-input"
                    value={name}
                    disabled={isEditing}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Luffy, Zoro, DevSage..."
                    maxLength={32}
                  />
                </div>

                <div className="studio-field-group">
                  <label className="studio-label">Função / Especialidade</label>
                  <select
                    className="studio-select"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                  >
                    <option value="Executor">Executor (Executa tarefas de terminal e rotinas)</option>
                    <option value="Developer">Developer (Desenvolvimento e engenharia de software)</option>
                    <option value="Research">Research (Pesquisa, síntese de documentações e web)</option>
                    <option value="Reviewer">Reviewer (Revisão de qualidade e testes)</option>
                    <option value="Investor">Investor (Mercado financeiro, B3 e dividendos)</option>
                  </select>
                </div>

                <div className="studio-field-group">
                  <label className="studio-label">Descrição Rápida</label>
                  <input
                    type="text"
                    className="studio-input"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ex: Responsável por compilar e validar comandos."
                    maxLength={240}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: SOUL & BOUNDARIES */}
            {activeTab === 'soul' && (
              <div className="studio-section">
                <div className="studio-field-group">
                  <label className="studio-label">
                    <span>Personalidade & Diretrizes Centrais</span>
                    <span className="studio-label-hint">Comportamento base do agente</span>
                  </label>
                  <textarea
                    className="studio-textarea"
                    rows={4}
                    value={soulPrompt}
                    onChange={e => setSoulPrompt(e.target.value)}
                    placeholder="Ex: Você é um espadachim pragmático e direto. Prefere soluções objetivas e não enrola em explicações longas."
                  />
                </div>

                <div className="studio-field-group">
                  <label className="studio-label">
                    <span>O que ele FAZ (Especialidades)</span>
                    <span className="studio-label-hint">Foco operacional</span>
                  </label>
                  <textarea
                    className="studio-textarea"
                    rows={3}
                    value={whatItDoes}
                    onChange={e => setWhatItDoes(e.target.value)}
                    placeholder="Ex: Executa rotinas de automação, refatora código TypeScript e roda testes unitários."
                  />
                </div>

                <div className="studio-field-group">
                  <label className="studio-label">
                    <span>O que ele NÃO FAZ (Limites & Guardrails)</span>
                    <span className="studio-label-hint">Fronteiras de segurança</span>
                  </label>
                  <textarea
                    className="studio-textarea"
                    rows={3}
                    value={whatItDoesNot}
                    onChange={e => setWhatItDoesNot(e.target.value)}
                    placeholder="Ex: Nunca apaga bancos de dados de produção, não realiza commits sem autorização explícita."
                  />
                </div>

                <div className="studio-field-group">
                  <label className="studio-label">Tom de Voz</label>
                  <div className="cosmetics-pills-row">
                    {['Direto e ágil', 'Formal e analítico', 'Descontraído', 'Educador paciente', 'Prudente financeiro'].map(t => (
                      <button
                        key={t}
                        type="button"
                        className={`cosmetic-pill-btn ${tone === t ? 'active' : ''}`}
                        onClick={() => setTone(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SKILLS */}
            {activeTab === 'skills' && (
              <div className="studio-section">
                <div style={{ marginBottom: '8px' }}>
                  <span className="studio-label">Ferramentas Autorizadas</span>
                  <span className="studio-label-hint">Selecione quais capacidades este bot pode invocar autonomamente</span>
                </div>

                <div className="skills-cards-grid">
                  {AVAILABLE_SKILLS.map(sk => {
                    const isEnabled = skills.includes(sk.id);
                    return (
                      <div
                        key={sk.id}
                        className={`skill-toggle-card ${isEnabled ? 'enabled' : ''}`}
                        onClick={() => toggleSkill(sk.id)}
                      >
                        <div className="skill-icon-box">
                          {renderSkillIcon(sk.id)}
                        </div>
                        <div className="skill-info">
                          <div className="skill-name">{sk.name}</div>
                          <div className="skill-desc">{sk.desc}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => {}}
                          className="skill-checkbox"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: MEMORY */}
            {activeTab === 'memory' && (
              <div className="studio-section">
                <div>
                  <span className="studio-label">Memória de Longo Prazo & Fatos</span>
                  <span className="studio-label-hint">Informações que o bot recorda entre diferentes conversas</span>
                </div>

                <div className="memory-add-row">
                  <input
                    type="text"
                    className="studio-input"
                    value={newMemoryText}
                    onChange={e => setNewMemoryText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMemory()}
                    placeholder="Ex: O usuário prefere respostas em português com bullet points."
                  />
                  <button type="button" className="memory-add-btn" onClick={handleAddMemory}>
                    <Plus size={14} />
                    <span>Adicionar</span>
                  </button>
                </div>

                <div className="memory-items-list">
                  {memories.length === 0 ? (
                    <div className="memory-empty-notice">
                      Nenhum fato memorizado ainda. Adicione regras ou notas contextuais acima.
                    </div>
                  ) : (
                    memories.map(m => (
                      <div key={m.id} className="memory-item-row">
                        <span className="memory-item-text">{m.text}</span>
                        <button
                          type="button"
                          className="memory-delete-btn"
                          onClick={() => handleDeleteMemory(m.id)}
                          title="Excluir memória"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: MODEL */}
            {activeTab === 'model' && (
              <div className="studio-section" style={{ maxWidth: '100%' }}>
                <ModelSelectorDrawer
                  selectedProvider={modelConfig.provider}
                  selectedModel={modelConfig.model}
                  selectedEffort={modelConfig.reasoningEffort}
                  onChange={newCfg => setModelConfig(newCfg)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="studio-footer">
          <button className="studio-cancel-btn" onClick={onClose}>
            <X size={14} />
            <span>Cancelar</span>
          </button>
          <button className="studio-save-btn" onClick={handleSave} disabled={saving}>
            <Check size={15} />
            <span>{saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Bot'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentStudioModal;
