import React, { useState } from 'react';
import WaddleAvatar, { AgentState, STATE_LABELS } from './WaddleAvatar';
import { AGENT_VISUALS } from '../utils/agentVisuals';
import './AvatarMotionLab.css';

type MotionVariant = 'off' | 'standard' | 'organic';

const LAB_AGENTS = ['Quinta', 'Atlas', 'Nero', 'Iris', 'Ma', 'Livro', 'Pixel', 'Motion', 'Data', 'Ops'];

const LAB_STATES: AgentState[] = [
  'idle', 'listening', 'thinking', 'planning', 'waiting', 'creating', 'done', 'blocked', 'stopped',
];

const VARIANTS: { id: MotionVariant; label: string; hint: string }[] = [
  { id: 'off', label: 'Estático', hint: 'Sem animação — para comparação.' },
  { id: 'standard', label: 'Estúdio', hint: 'Loops constantes e previsíveis.' },
  { id: 'organic', label: 'Vivos', hint: 'Piscar irregular, olhar e respiração orgânicos.' },
];

const SCALE_SIZES = [20, 28, 36, 48, 64, 96];

/**
 * Playground para iterar nos conceitos de motion dos avatares,
 * no espírito do laboratório "Social Agents" da referência.
 */
const AvatarMotionLab: React.FC = () => {
  const [agent, setAgent] = useState('Quinta');
  const [state, setState] = useState<AgentState>('idle');
  const [variant, setVariant] = useState<MotionVariant>('organic');
  const [trackMouse, setTrackMouse] = useState(true);

  const visual = AGENT_VISUALS[agent] || { color: '#1e1e1e', marking: 'none' as const, clickAnim: 'hop' as const, quote: '' };

  return (
    <div className="amlab">
      <header className="amlab__header">
        <div>
          <p className="amlab__kicker">LABORATÓRIO DE MOTION · WADDLE</p>
          <h1 className="amlab__title">A mesma equipe. Agora viva.</h1>
          <p className="amlab__sub">
            Micro-expressões por estado: piscar irregular, olhar e respiração orgânicos.
          </p>
        </div>
        <a className="amlab__back" href="/">← Voltar ao app</a>
      </header>

      <section className="amlab__stage" aria-label="Palco do avatar">
        <WaddleAvatar
          key={agent}
          color={visual.color}
          marking={visual.marking}
          cosmetics={visual.cosmetics}
          imageUrl={visual.imageUrl}
          quote={visual.quote}
          state={state}
          motion={variant}
          trackMouse={trackMouse}
          interactive
          clickAnim={visual.clickAnim}
          size={300}
          showPresence
        />
      </section>

      <section className="amlab__panel" aria-label="Controles">
        <div className="amlab__group">
          <p className="amlab__label">VERSÕES VISUAIS</p>
          <div className="amlab__tabs" role="group" aria-label="Versões visuais">
            {VARIANTS.map(v => (
              <button
                key={v.id}
                className={`amlab__tab ${variant === v.id ? 'is-active' : ''}`}

                onClick={() => setVariant(v.id)}
                title={v.hint}
              >
                {v.label}
              </button>
            ))}
          </div>
          <p className="amlab__hint">{VARIANTS.find(v => v.id === variant)?.hint}</p>
          <label className="amlab__check">
            <input type="checkbox" checked={trackMouse} onChange={e => setTrackMouse(e.target.checked)} />
            Olhos seguem o cursor
          </label>
        </div>

        <div className="amlab__group">
          <p className="amlab__label">ESTADO DO AGENTE</p>
          <div className="amlab__states" role="group" aria-label="Estado do agente">
            {LAB_STATES.map((s, i) => (
              <button
                key={s}
                className={`amlab__state ${state === s ? 'is-active' : ''}`}

                onClick={() => setState(s)}
              >
                <span className="amlab__state-num">{String(i + 1).padStart(2, '0')}</span>
                {STATE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="amlab__group">
          <p className="amlab__label">EQUIPE</p>
          <div className="amlab__agents" role="group" aria-label="Equipe">
            {LAB_AGENTS.map(name => (
              <button
                key={name}
                className={`amlab__agent ${agent === name ? 'is-active' : ''}`}

                onClick={() => setAgent(name)}
              >
                <WaddleAvatar
                  color={AGENT_VISUALS[name].color}
                  marking={AGENT_VISUALS[name].marking}
                  cosmetics={AGENT_VISUALS[name].cosmetics}
                  imageUrl={AGENT_VISUALS[name].imageUrl}
                  state="idle"
                  motion={agent === name ? 'organic' : 'standard'}
                  size={44}
                />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="amlab__group">
          <p className="amlab__label">ESCALA DE INTERFACE</p>
          <div className="amlab__scale" aria-label="Agentes em escala de interface">
            {SCALE_SIZES.map(sz => (
              <WaddleAvatar
                key={sz}
                color={visual.color}
                marking={visual.marking}
                cosmetics={visual.cosmetics}
                imageUrl={visual.imageUrl}
                state={state}
                motion={variant}
                size={sz}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AvatarMotionLab;
