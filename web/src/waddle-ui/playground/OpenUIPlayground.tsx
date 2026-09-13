import React, { useState, useEffect } from 'react';
import { componentMetadataList } from '../registry.ts';
import { OpenUIRenderer } from '../OpenUIRenderer.tsx';
import { actionRouter } from '../actions.ts';
import type { UIAction } from '../types.ts';
import './OpenUIPlayground.css';

interface OpenUIPlaygroundProps {
  onClose?: () => void;
}

export const OpenUIPlayground: React.FC<OpenUIPlaygroundProps> = ({ onClose }) => {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [code, setCode] = useState(componentMetadataList[0]?.exampleOpenUI || '');
  const [actionHistory, setActionHistory] = useState<UIAction[]>(() => actionRouter.getHistory());

  useEffect(() => {
    const unsub = actionRouter.subscribe((action) => {
      setActionHistory((prev) => [action, ...prev.slice(0, 19)]);
    });
    return unsub;
  }, []);

  const handleSelectPreset = (index: number) => {
    setSelectedPresetIndex(index);
    setCode(componentMetadataList[index]?.exampleOpenUI || '');
  };

  const handleClearActions = () => {
    actionRouter.clearHistory();
    setActionHistory([]);
  };

  const currentMeta = componentMetadataList[selectedPresetIndex];

  return (
    <div className="wui-playground-overlay">
      {/* Header */}
      <header className="wui-playground-header">
        <div className="wui-playground-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚡</span>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
              Waddle Agent OS — Generative UI Lab
            </h2>
          </div>
          <span className="wui-playground-badge">OpenUI Controlled Rendering</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onClose && (
            <button
              type="button"
              className="wui-btn wui-btn-secondary wui-btn-sm"
              onClick={onClose}
            >
              Fechar Playground ✕
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="wui-playground-body">
        {/* Left Column: Preset Selector & Code Editor & Action Log */}
        <div className="wui-playground-left-col">
          {/* Preset Buttons */}
          <div className="wui-preset-pills">
            {componentMetadataList.map((meta, idx) => (
              <button
                key={meta.name}
                type="button"
                className={`wui-preset-pill ${idx === selectedPresetIndex ? 'is-active' : ''}`}
                onClick={() => handleSelectPreset(idx)}
                title={`${meta.description} (@${meta.agent})`}
              >
                {meta.name} <small style={{ opacity: 0.75 }}>({meta.agent})</small>
              </button>
            ))}
          </div>

          {/* Editor */}
          <div className="wui-editor-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="wui-section-title">Editor de Código OpenUI</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {currentMeta?.description}
              </span>
            </div>
            <textarea
              className="wui-code-editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              placeholder="Digite código OpenUI, JSON ou tags JSX..."
            />
          </div>

          {/* Action Event Log */}
          <div className="wui-actions-log">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="wui-section-title">
                Action Router Log ({actionHistory.length})
              </span>
              {actionHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearActions}
                  style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '11px' }}
                >
                  Limpar
                </button>
              )}
            </div>

            {actionHistory.length === 0 ? (
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Clique nos botões interativos do preview para inspecionar os eventos gerados.
              </div>
            ) : (
              actionHistory.map((act) => (
                <div key={act.id} className="wui-action-item">
                  <div>
                    <strong style={{ color: '#818cf8' }}>{act.action}</strong>
                    {act.payload && (
                      <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
                        {JSON.stringify(act.payload).slice(0, 45)}
                      </span>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                    {new Date(act.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Live Interactive Rendering */}
        <div className="wui-playground-right-col">
          <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span className="wui-section-title">Visualização Interativa em Tempo Real</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Componente: <strong>{currentMeta?.name}</strong> · Agente: <strong>{currentMeta?.agent}</strong>
              </span>
            </div>

            {/* Live Component Render */}
            <div style={{ background: 'var(--bg-secondary, #1e293b)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))' }}>
              <OpenUIRenderer content={code} />
            </div>

            {/* Hint Box */}
            <div style={{ marginTop: '24px', padding: '14px 16px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#818cf8', marginBottom: '4px' }}>
                💡 Controlled Rendering Seguro
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Apenas componentes registrados em <code>waddleUIRegistry</code> são permitidos. Scripts, HTML arbitrário ou <code>eval()</code> são bloqueados automaticamente pelo parser.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
