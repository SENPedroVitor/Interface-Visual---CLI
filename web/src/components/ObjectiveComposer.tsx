import React, { useState } from 'react';

interface ObjectiveComposerProps {
  onSubmit: (objective: string) => Promise<void>;
  disabled: boolean;
}

const PRESETS = [
  'Criar arquivo de notas do projeto e verificar conteúdo',
  'Executar comando de diagnóstico e checar status',
  'Pesquisar ferramentas e consolidar em resumo',
];

export const ObjectiveComposer: React.FC<ObjectiveComposerProps> = ({ onSubmit, disabled }) => {
  const [objective, setObjective] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSubmit(objective.trim());
      setObjective('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePresetClick = (preset: string) => {
    setObjective(preset);
  };

  return (
    <section className="panel-card composer-card">
      <div className="panel-title">
        <span>Definir Objetivo para os Agentes</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Orquestração Multiagente</span>
      </div>

      <form onSubmit={handleSubmit} className="composer-box">
        <div className="composer-input-row">
          <textarea
            className="composer-textarea"
            placeholder="Ex: Crie um arquivo com a arquitetura do Waddle e execute a verificação..."
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            disabled={disabled || isSubmitting}
            rows={2}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!objective.trim() || disabled || isSubmitting}
          >
            {isSubmitting ? 'Iniciando...' : '▶ Executar'}
          </button>
        </div>

        <div className="preset-pills">
          <span className="preset-pill-label">Sugestões rápidas:</span>
          {PRESETS.map((preset, index) => (
            <button
              key={index}
              type="button"
              className="preset-pill"
              onClick={() => handlePresetClick(preset)}
              disabled={disabled || isSubmitting}
            >
              {preset}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
};
