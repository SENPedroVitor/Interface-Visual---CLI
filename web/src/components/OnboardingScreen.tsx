import React, { useState, useEffect } from "react";
import { WaddleAvatar } from "./WaddleAvatar";
import type { AgentState } from "./WaddleAvatar";
import { Highlighter } from "./Highlighter";
import { LightRays } from "./LightRays";
import { createAgent } from "../services/api";
import "./OnboardingScreen.css";

export const ONBOARDING_KEY = "waddle-onboarded";

interface OnboardingScreenProps {
  onComplete: () => void;
}

type ManagerTitle = "Gerente" | "Mestre" | "Pai";

interface TitleOption {
  key: ManagerTitle;
  label: string;
  desc: string;
  color: string;
  state: AgentState;
  icon: React.ReactNode;
}

const TITLE_OPTIONS: TitleOption[] = [
  {
    key: "Gerente",
    label: "Gerente",
    desc: "Focado em resultados, delega tarefas e coordena o time.",
    color: "#9159fe",
    state: "working",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    key: "Mestre",
    label: "Mestre",
    desc: "Estratégico, visionário e sempre um passo à frente.",
    color: "#0ea5e9",
    state: "thinking",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04z" />
      </svg>
    ),
  },
  {
    key: "Pai",
    label: "Pai",
    desc: "Cria e cuida da equipe com paciência e liderança.",
    color: "#10b981",
    state: "idle",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

type Step = "welcome" | "name" | "title" | "creating";

/* ── Dynamic Avatar Visuals based on typed name ────────────── */
export interface BotVisualProfile {
  imageUrl: string;
  color: string;
  accent: string;
  badge: string;
}

const PRESETS: Record<string, BotVisualProfile> = {
  quinta: { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Líder Supremo 👑" },
  chefe:  { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "O Chefão 👑" },
  boss:   { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Big Boss 👑" },
  rei:    { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Majestade 👑" },
  king:   { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Rei da Equipe 👑" },

  atlas:    { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Mente Brilhante 🧠" },
  sabio:    { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "O Sábio Ancião 📜" },
  mestre:   { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Grão-Mestre 🥋" },
  guru:     { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Guru Estratégico 🔮" },
  socrates: { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Filósofo 🏛️" },
  neo:      { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "O Escolhido 🕶️" },

  nero:   { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Mago dos Códigos ⚡" },
  turbo:  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Ultra Veloz 🚀" },
  flash:  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Velocista ⚡" },
  sonic:  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Super Sônico 🌀" },
  bolt:   { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Raio Elétrico ⚡" },
  dev:    { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Engenheiro Chefe 💻" },
  max:    { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Potência Máxima 🔋" },

  iris:   { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Olho Clínico 🌿" },
  eco:    { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Guardião Natural 🍃" },
  flora:  { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Espírito Zen 🌸" },
  jade:   { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Pedra Preciosa 💎" },

  ma:       { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Lobo de Wall Street 💰" },
  totem:    { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Guardião Ancestral 🗿" },
  gold:     { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Toque de Midas ✨" },
  investor: { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Magnata Financeiro 📈" },
  thor:     { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Força Bruta 🔨" },

  livro:   { imageUrl: "/avatars/livro.png", color: "#6366f1", accent: "#1e3a5f", badge: "Enciclopédia Viva 📚" },
  kobe:    { imageUrl: "/avatars/livro.png", color: "#8b5cf6", accent: "#1e3a5f", badge: "Mamba Mentality 🏀" },
  jordan:  { imageUrl: "/avatars/livro.png", color: "#ef4444", accent: "#1e3a5f", badge: "O GOAT 🏆" },
  campeao: { imageUrl: "/avatars/livro.png", color: "#2563eb", accent: "#1e3a5f", badge: "Espírito Campeão 🥇" },

  luna:   { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Luz Estelar ✨" },
  brilho: { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Brilho Radiante 💖" },
  star:   { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Supernova 🌟" },
  ruby:   { imageUrl: "/avatars/brilho.png", color: "#f43f5e", accent: "#4a1440", badge: "Joia Rara 💎" },
  aurora: { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Aurora Boreal 🌌" },

  shadow: { imageUrl: "/avatars/padrao.png", color: "#64748b", accent: "#0f172a", badge: "Guerreiro das Sombras 🥷" },
  batman: { imageUrl: "/avatars/padrao.png", color: "#475569", accent: "#020617", badge: "Cavaleiro das Trevas 🦇" },
  ninja:  { imageUrl: "/avatars/padrao.png", color: "#475569", accent: "#0f172a", badge: "Silencioso e Preciso ⚔️" },
};

const PALETTE_ROTATION: BotVisualProfile[] = [
  { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Estrategista 👑" },
  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Veloz & Prático ⚡" },
  { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Analítico 🧠" },
  { imageUrl: "/avatars/eco.png",   color: "#10b981", accent: "#16382a", badge: "Organizado 🌿" },
  { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Determinado 🛡️" },
  { imageUrl: "/avatars/brilho.png",color: "#ec4899", accent: "#4a1440", badge: "Criativo ✨" },
  { imageUrl: "/avatars/livro.png", color: "#6366f1", accent: "#1e3a5f", badge: "Especialista 📚" },
];

export function resolveBotVisual(name: string): BotVisualProfile {
  const clean = name.trim().toLowerCase();
  if (!clean) {
    return { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Líder 👑" };
  }

  // Exact or prefix match in presets
  for (const [key, val] of Object.entries(PRESETS)) {
    if (clean === key || (clean.length >= 3 && clean.startsWith(key))) return val;
  }

  // Deterministic hash based on all characters
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return PALETTE_ROTATION[hash % PALETTE_ROTATION.length];
}

/* ── Mystery avatar flip ────────────────────────────────────── */
function MysteryAvatar({
  revealed,
  size,
  visual,
}: {
  revealed: boolean;
  size: number;
  visual: BotVisualProfile;
}) {
  return (
    <div
      className={`onboarding-mystery-wrap ${revealed ? "is-revealed" : ""}`}
      style={{ width: size, height: size }}
    >
      <div className="onboarding-mystery-side onboarding-mystery-front">
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
          <rect
            x="14"
            y="30"
            width="72"
            height="42"
            rx="21"
            fill={revealed ? visual.color : "#d1d5db"}
            style={{ transition: "fill 0.3s ease" }}
          />
          <text
            x="50"
            y="58"
            textAnchor="middle"
            fontSize="28"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
            fill={revealed ? "#ffffff" : "#6b7280"}
            style={{ transition: "fill 0.3s ease" }}
          >
            ?
          </text>
        </svg>
      </div>
      <div className="onboarding-mystery-side onboarding-mystery-back">
        <WaddleAvatar
          key={visual.imageUrl + visual.color}
          imageUrl={visual.imageUrl}
          color={visual.accent}
          state="idle"
          size={size}
          gazeX={0.3}
        />
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>("welcome");
  const [botName, setBotName] = useState("");
  const [selectedTitle, setSelectedTitle] = useState<ManagerTitle>("Gerente");
  const [error, setError] = useState("");
  const [highlightReady, setHighlightReady] = useState(false);
  const [wobble, setWobble] = useState(false);
  const [turningToBtn, setTurningToBtn] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHighlightReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  const selectedOption = TITLE_OPTIONS.find((o) => o.key === selectedTitle)!;
  const nameRevealed = botName.trim().length >= 1;
  const botVisual = resolveBotVisual(botName);

  /* Avatar turns towards the button on click, then advances to name step */
  const handleStartClick = () => {
    setTurningToBtn(true);
    setTimeout(() => {
      setStep("name");
      setTurningToBtn(false);
    }, 480);
  };

  const handleNameNext = () => {
    if (!botName.trim()) {
      setError("Dê um nome ao seu bot antes de continuar.");
      setWobble(true);
      setTimeout(() => setWobble(false), 600);
      return;
    }
    setStep("title");
  };

  const handleBack = (to: Step) => setStep(to);

  const handleCreate = async () => {
    setStep("creating");
    try {
      await createAgent({
        name: botName.trim(),
        role: "Manager",
        description: `Bot ${selectedTitle} criado no onboarding. Coordena os outros agentes da equipe.`,
        avatar_config: {
          imageUrl: botVisual.imageUrl,
          color: botVisual.color,
        },
      });
    } catch (_) {
      // Agent already exists or any error — just proceed
    }
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };

  return (
    <div className="onboarding-root">
      {/* ── Light Rays (MagicUI) for welcome presentation ── */}
      {step === "welcome" && (
        <LightRays
          count={8}
          color="rgba(145, 89, 254, 0.42)"
          blur={36}
          speed={14}
          length="88vh"
        />
      )}

      <div className="onboarding-card">

        {/* ── Welcome ── */}
        {step === "welcome" && (
          <div className="onboarding-step onboarding-step--welcome">
            <div className={`onboarding-mascot ${turningToBtn ? "is-turning-to-button" : ""}`}>
              <WaddleAvatar
                imageUrl="/avatars/chefe.png"
                color="#2d1b4e"
                state="idle"
                size={110}
                trackMouse={!turningToBtn}
                interactive
                clickAnim="jump2"
              />
            </div>

            <h1 className="onboarding-title">
              Bem-vindo ao{" "}
              {highlightReady ? (
                <Highlighter action="highlight" color="#9159fe" animationDuration={900} strokeWidth={2.5} padding={5}>
                  <span className="onboarding-highlight-text">Waddle</span>
                </Highlighter>
              ) : (
                <span>Waddle</span>
              )}
            </h1>

            <p className="onboarding-sub">
              Sua equipe de bots que{" "}
              {highlightReady ? (
                <Highlighter action="underline" color="#a87ffe" strokeWidth={2.5} animationDuration={800} padding={2}>
                  fazem trabalho de verdade.
                </Highlighter>
              ) : (
                <span>fazem trabalho de verdade.</span>
              )}
            </p>

            <button
              className="onboarding-btn onboarding-btn--primary"
              onClick={handleStartClick}
              disabled={turningToBtn}
            >
              Começar
            </button>
          </div>
        )}

        {/* ── Name ── */}
        {step === "name" && (
          <div className="onboarding-step">
            <div className="onboarding-mascot">
              <MysteryAvatar revealed={nameRevealed} size={90} visual={botVisual} />
            </div>

            <h2 className="onboarding-heading">
              Como vai se chamar<br />seu bot chefe?
            </h2>

            <div className="onboarding-hint-wrap">
              {nameRevealed ? (
                <div
                  className="onboarding-badge-tag"
                  style={{
                    background: `${botVisual.color}18`,
                    color: botVisual.color,
                    borderColor: `${botVisual.color}35`,
                  }}
                >
                  <span>{botVisual.badge}</span>
                </div>
              ) : (
                <p className="onboarding-hint">
                  Digite o nome para revelar seu bot.
                </p>
              )}
            </div>

            <div className={`onboarding-input-wrap ${wobble ? "wobble" : ""}`}>
              <input
                className="onboarding-input"
                type="text"
                placeholder="Ex: Quinta, Atlas, Nero, Luna…"
                maxLength={24}
                value={botName}
                onChange={(e) => {
                  setBotName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && botName.trim()) handleNameNext();
                }}
                autoFocus
              />
              {nameRevealed && <span className="onboarding-input-check">ok</span>}
            </div>

            {error && <p className="onboarding-error">{error}</p>}

            <div className="onboarding-actions">
              <button className="onboarding-btn onboarding-btn--ghost" onClick={() => handleBack("welcome")}>
                Voltar
              </button>
              <button
                className="onboarding-btn onboarding-btn--primary"
                disabled={!botName.trim()}
                onClick={handleNameNext}
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* ── Title ── */}
        {step === "title" && (
          <div className="onboarding-step">
            <div className="onboarding-mascot">
              <WaddleAvatar
                key={botVisual.imageUrl + botVisual.color + selectedTitle}
                imageUrl={botVisual.imageUrl}
                color={botVisual.accent}
                state={selectedOption.state}
                size={90}
              />
            </div>

            <h2 className="onboarding-heading">
              Qual é o papel do{" "}
              <strong style={{ color: botVisual.color }}>{botName}</strong>?
            </h2>
            <p className="onboarding-hint">Isso define como ele lidera os outros bots.</p>

            <div className="onboarding-title-grid">
              {TITLE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={`onboarding-title-card ${selectedTitle === opt.key ? "is-selected" : ""}`}
                  style={
                    selectedTitle === opt.key
                      ? { borderColor: opt.color, boxShadow: `0 0 0 3px ${opt.color}22` }
                      : {}
                  }
                  onClick={() => setSelectedTitle(opt.key)}
                >
                  <div
                    className="onboarding-title-icon-badge"
                    style={{
                      background: `${opt.color}15`,
                      color: opt.color,
                      borderColor: `${opt.color}30`,
                    }}
                  >
                    {opt.icon}
                  </div>
                  <span className="onboarding-title-name">{opt.label}</span>
                  <span className="onboarding-title-desc">{opt.desc}</span>
                </button>
              ))}
            </div>

            {error && <p className="onboarding-error">{error}</p>}

            <div className="onboarding-actions">
              <button className="onboarding-btn onboarding-btn--ghost" onClick={() => handleBack("name")}>
                Voltar
              </button>
              <button
                className="onboarding-btn onboarding-btn--primary"
                onClick={handleCreate}
              >
                Criar {botName}
              </button>
            </div>
          </div>
        )}

        {/* ── Creating ── */}
        {step === "creating" && (
          <div className="onboarding-step onboarding-step--creating">
            <WaddleAvatar
              key={botVisual.imageUrl}
              imageUrl={botVisual.imageUrl}
              color={botVisual.accent}
              state="working"
              size={90}
            />
            <p className="onboarding-creating-text">
              Criando <strong>{botName}</strong>...
            </p>
          </div>
        )}

        {/* ── Progress dots ── */}
        <div className="onboarding-progress">
          {(["welcome", "name", "title"] as Step[]).map((s) => (
            <span
              key={s}
              className={`onboarding-dot ${
                step === s || (step === "creating" && s === "title") ? "is-active" : ""
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
