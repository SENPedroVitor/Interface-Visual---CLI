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
type RoleIconVariant = "manager" | "master" | "guardian";

interface TitleOption {
  key: ManagerTitle;
  label: string;
  desc: string;
  color: string;
  state: AgentState;
  icon: React.ReactNode;
}

function RoleVectorIcon({ variant }: { variant: RoleIconVariant }) {
  if (variant === "manager") {
    return (
      <svg className="onboarding-role-vector" viewBox="0 0 24 24" aria-hidden>
        <rect x="8.25" y="3.75" width="7.5" height="5" rx="1.8" />
        <path d="M12 8.75v2.65" />
        <path d="M6.5 11.4h11" />
        <path d="M6.5 11.4v2.15" />
        <path d="M12 11.4v2.15" />
        <path d="M17.5 11.4v2.15" />
        <rect x="4.2" y="13.55" width="4.6" height="6.2" rx="1.6" />
        <rect x="9.7" y="13.55" width="4.6" height="6.2" rx="1.6" />
        <rect x="15.2" y="13.55" width="4.6" height="6.2" rx="1.6" />
      </svg>
    );
  }

  if (variant === "master") {
    return (
      <svg className="onboarding-role-vector" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="8.25" />
        <path d="M15.65 8.35l-2 5.55-5.3 1.75 2-5.55 5.3-1.75Z" />
        <path d="M12 5.9v1.35" />
        <path d="M12 16.75v1.35" />
        <path d="M5.9 12h1.35" />
        <path d="M16.75 12h1.35" />
        <circle className="onboarding-role-vector-dot" cx="12" cy="12" r="0.95" />
      </svg>
    );
  }

  return (
    <svg className="onboarding-role-vector" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3.75 18.25 6v5.35c0 4.1-2.5 7.05-6.25 8.9-3.75-1.85-6.25-4.8-6.25-8.9V6L12 3.75Z" />
      <circle className="onboarding-role-vector-dot" cx="12" cy="10.45" r="1.25" />
      <path d="M8.75 15.45c.6-1.55 1.7-2.35 3.25-2.35s2.65.8 3.25 2.35" />
    </svg>
  );
}

const TITLE_OPTIONS: TitleOption[] = [
  {
    key: "Gerente",
    label: "Gerente",
    desc: "Focado em resultados, delega tarefas e coordena o time.",
    color: "#9159fe",
    state: "working",
    icon: <RoleVectorIcon variant="manager" />,
  },
  {
    key: "Mestre",
    label: "Mestre",
    desc: "Estratégico, visionário e sempre um passo à frente.",
    color: "#0ea5e9",
    state: "thinking",
    icon: <RoleVectorIcon variant="master" />,
  },
  {
    key: "Pai",
    label: "Pai",
    desc: "Cria e cuida da equipe com paciência e liderança.",
    color: "#10b981",
    state: "idle",
    icon: <RoleVectorIcon variant="guardian" />,
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
  quinta: { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Líder Supremo" },
  chefe:  { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "O Chefão" },
  boss:   { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Big Boss" },
  rei:    { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Majestade" },
  king:   { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Rei da Equipe" },

  atlas:    { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Mente Brilhante" },
  sabio:    { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "O Sábio Ancião" },
  mestre:   { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Grão-Mestre" },
  guru:     { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Guru Estratégico" },
  socrates: { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Filósofo" },
  neo:      { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "O Escolhido" },

  nero:   { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Mago dos Códigos" },
  turbo:  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Ultra Veloz" },
  flash:  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Velocista" },
  sonic:  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Super Sônico" },
  bolt:   { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Raio Elétrico" },
  dev:    { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Engenheiro Chefe" },
  max:    { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Potência Máxima" },

  iris:   { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Olho Clínico" },
  eco:    { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Guardião Natural" },
  flora:  { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Espírito Zen" },
  jade:   { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Pedra Preciosa" },

  ma:       { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Lobo de Wall Street" },
  totem:    { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Guardião Ancestral" },
  gold:     { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Toque de Midas" },
  investor: { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Magnata Financeiro" },
  thor:     { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Força Bruta" },

  livro:   { imageUrl: "/avatars/livro.png", color: "#6366f1", accent: "#1e3a5f", badge: "Enciclopédia Viva" },
  kobe:    { imageUrl: "/avatars/livro.png", color: "#8b5cf6", accent: "#1e3a5f", badge: "Mamba Mentality" },
  jordan:  { imageUrl: "/avatars/livro.png", color: "#ef4444", accent: "#1e3a5f", badge: "O GOAT" },
  campeao: { imageUrl: "/avatars/livro.png", color: "#2563eb", accent: "#1e3a5f", badge: "Espírito Campeão" },

  luna:   { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Luz Estelar" },
  brilho: { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Brilho Radiante" },
  star:   { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Supernova" },
  ruby:   { imageUrl: "/avatars/brilho.png", color: "#f43f5e", accent: "#4a1440", badge: "Joia Rara" },
  aurora: { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Aurora Boreal" },

  shadow: { imageUrl: "/avatars/padrao.png", color: "#64748b", accent: "#0f172a", badge: "Guerreiro das Sombras" },
  batman: { imageUrl: "/avatars/padrao.png", color: "#475569", accent: "#020617", badge: "Cavaleiro das Trevas" },
  ninja:  { imageUrl: "/avatars/padrao.png", color: "#475569", accent: "#0f172a", badge: "Silencioso e Preciso" },
};

const PALETTE_ROTATION: BotVisualProfile[] = [
  { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Estrategista" },
  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Veloz & Prático" },
  { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Analítico" },
  { imageUrl: "/avatars/eco.png",   color: "#10b981", accent: "#16382a", badge: "Organizado" },
  { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Determinado" },
  { imageUrl: "/avatars/brilho.png",color: "#ec4899", accent: "#4a1440", badge: "Criativo" },
  { imageUrl: "/avatars/livro.png", color: "#6366f1", accent: "#1e3a5f", badge: "Especialista" },
];

export function resolveBotVisual(name: string): BotVisualProfile {
  const clean = name.trim().toLowerCase();
  if (!clean) {
    return { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Líder" };
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
                    color: botVisual.color,
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
                      color: opt.color,
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
