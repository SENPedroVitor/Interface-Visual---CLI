import React, { useState, useEffect } from "react";
import {
  Shield,
  Crown,
  Zap,
  Brain,
  Leaf,
  Sparkles,
  BookOpen,
  Rocket,
  Trophy,
  Swords,
  Code2,
  TrendingUp,
  Gem,
  Target,
  Briefcase,
  Home,
  Check,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { WaddleAvatar } from "./WaddleAvatar";
import type { AgentState } from "./WaddleAvatar";
import { Highlighter } from "./Highlighter";
import { LightRays } from "./LightRays";
import { ShimmerButton } from "./ShimmerButton";
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
    icon: <Briefcase size={22} strokeWidth={2.2} />,
  },
  {
    key: "Mestre",
    label: "Mestre",
    desc: "Estratégico, visionário e sempre um passo à frente.",
    color: "#0ea5e9",
    state: "thinking",
    icon: <Brain size={22} strokeWidth={2.2} />,
  },
  {
    key: "Pai",
    label: "Pai",
    desc: "Cria e cuida da equipe com paciência e liderança.",
    color: "#10b981",
    state: "idle",
    icon: <Home size={22} strokeWidth={2.2} />,
  },
];

type Step = "welcome" | "name" | "title" | "creating";

/* ── Dynamic Avatar Visuals based on typed name ────────────── */
export type BadgeIconType =
  | "shield"
  | "crown"
  | "zap"
  | "brain"
  | "leaf"
  | "sparkles"
  | "book"
  | "rocket"
  | "trophy"
  | "swords"
  | "code"
  | "trending"
  | "gem"
  | "target";

export interface BotVisualProfile {
  imageUrl: string;
  color: string;
  accent: string;
  badge: string;
  icon?: BadgeIconType;
}

export function BadgeSvgIcon({ icon = "shield", size = 15 }: { icon?: BadgeIconType; size?: number }) {
  const strokeWidth = 2.2;
  switch (icon) {
    case "shield":
      return <Shield size={size} strokeWidth={strokeWidth} />;
    case "crown":
      return <Crown size={size} strokeWidth={strokeWidth} />;
    case "zap":
      return <Zap size={size} strokeWidth={strokeWidth} />;
    case "brain":
      return <Brain size={size} strokeWidth={strokeWidth} />;
    case "leaf":
      return <Leaf size={size} strokeWidth={strokeWidth} />;
    case "sparkles":
      return <Sparkles size={size} strokeWidth={strokeWidth} />;
    case "book":
      return <BookOpen size={size} strokeWidth={strokeWidth} />;
    case "rocket":
      return <Rocket size={size} strokeWidth={strokeWidth} />;
    case "trophy":
      return <Trophy size={size} strokeWidth={strokeWidth} />;
    case "swords":
      return <Swords size={size} strokeWidth={strokeWidth} />;
    case "code":
      return <Code2 size={size} strokeWidth={strokeWidth} />;
    case "trending":
      return <TrendingUp size={size} strokeWidth={strokeWidth} />;
    case "gem":
      return <Gem size={size} strokeWidth={strokeWidth} />;
    case "target":
    default:
      return <Target size={size} strokeWidth={strokeWidth} />;
  }
}

const PRESETS: Record<string, BotVisualProfile> = {
  quinta: { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Líder Supremo", icon: "crown" },
  chefe:  { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "O Chefão", icon: "crown" },
  boss:   { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Big Boss", icon: "crown" },
  rei:    { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Majestade", icon: "crown" },
  king:   { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Rei da Equipe", icon: "crown" },

  atlas:    { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Mente Brilhante", icon: "brain" },
  sabio:    { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "O Sábio Ancião", icon: "book" },
  mestre:   { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Grão-Mestre", icon: "target" },
  guru:     { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Guru Estratégico", icon: "sparkles" },
  socrates: { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Filósofo", icon: "book" },
  neo:      { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "O Escolhido", icon: "zap" },

  nero:   { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Mago dos Códigos", icon: "code" },
  turbo:  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Ultra Veloz", icon: "rocket" },
  flash:  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Velocista", icon: "zap" },
  sonic:  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Super Sônico", icon: "zap" },
  bolt:   { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Raio Elétrico", icon: "zap" },
  dev:    { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Engenheiro Chefe", icon: "code" },
  max:    { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Potência Máxima", icon: "zap" },

  iris:   { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Olho Clínico", icon: "leaf" },
  eco:    { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Guardião Natural", icon: "leaf" },
  flora:  { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Espírito Zen", icon: "sparkles" },
  jade:   { imageUrl: "/avatars/eco.png", color: "#10b981", accent: "#16382a", badge: "Pedra Preciosa", icon: "gem" },

  ma:       { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Lobo de Wall Street", icon: "trending" },
  totem:    { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Guardião Ancestral", icon: "shield" },
  gold:     { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Toque de Midas", icon: "sparkles" },
  investor: { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Magnata Financeiro", icon: "trending" },
  thor:     { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Força Bruta", icon: "shield" },

  livro:   { imageUrl: "/avatars/livro.png", color: "#6366f1", accent: "#1e3a5f", badge: "Enciclopédia Viva", icon: "book" },
  kobe:    { imageUrl: "/avatars/livro.png", color: "#8b5cf6", accent: "#1e3a5f", badge: "Mamba Mentality", icon: "trophy" },
  jordan:  { imageUrl: "/avatars/livro.png", color: "#ef4444", accent: "#1e3a5f", badge: "O GOAT", icon: "trophy" },
  campeao: { imageUrl: "/avatars/livro.png", color: "#2563eb", accent: "#1e3a5f", badge: "Espírito Campeão", icon: "trophy" },

  luna:   { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Luz Estelar", icon: "sparkles" },
  brilho: { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Brilho Radiante", icon: "sparkles" },
  star:   { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Supernova", icon: "sparkles" },
  ruby:   { imageUrl: "/avatars/brilho.png", color: "#f43f5e", accent: "#4a1440", badge: "Joia Rara", icon: "gem" },
  aurora: { imageUrl: "/avatars/brilho.png", color: "#ec4899", accent: "#4a1440", badge: "Aurora Boreal", icon: "sparkles" },

  shadow: { imageUrl: "/avatars/padrao.png", color: "#64748b", accent: "#0f172a", badge: "Guerreiro das Sombras", icon: "swords" },
  batman: { imageUrl: "/avatars/padrao.png", color: "#475569", accent: "#020617", badge: "Cavaleiro das Trevas", icon: "shield" },
  ninja:  { imageUrl: "/avatars/padrao.png", color: "#475569", accent: "#0f172a", badge: "Silencioso e Preciso", icon: "swords" },
};

const PALETTE_ROTATION: BotVisualProfile[] = [
  { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Estrategista", icon: "crown" },
  { imageUrl: "/avatars/turbo.png", color: "#3b82f6", accent: "#14284b", badge: "Veloz & Prático", icon: "zap" },
  { imageUrl: "/avatars/sabio.png", color: "#0ea5e9", accent: "#123f3a", badge: "Analítico", icon: "brain" },
  { imageUrl: "/avatars/eco.png",   color: "#10b981", accent: "#16382a", badge: "Organizado", icon: "leaf" },
  { imageUrl: "/avatars/totem.png", color: "#f59e0b", accent: "#3a2a1d", badge: "Determinado", icon: "shield" },
  { imageUrl: "/avatars/brilho.png",color: "#ec4899", accent: "#4a1440", badge: "Criativo", icon: "sparkles" },
  { imageUrl: "/avatars/livro.png", color: "#6366f1", accent: "#1e3a5f", badge: "Especialista", icon: "book" },
];

export function resolveBotVisual(name: string): BotVisualProfile {
  const clean = name.trim().toLowerCase();
  if (!clean) {
    return { imageUrl: "/avatars/chefe.png", color: "#9159fe", accent: "#2d1b4e", badge: "Líder", icon: "crown" };
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

            <ShimmerButton
              className="onboarding-start-btn"
              onClick={handleStartClick}
              disabled={turningToBtn}
              shimmerColor="#ffffff"
              background="#0f0f13"
              borderRadius="999px"
              shimmerDuration="2.8s"
              shimmerSize="0.08em"
            >
              Começar
            </ShimmerButton>
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
                <div className="onboarding-badge-tag">
                  <span className="onboarding-badge-text">{botVisual.badge}</span>
                  <span className="onboarding-badge-icon" style={{ color: botVisual.color }}>
                    <BadgeSvgIcon icon={botVisual.icon} size={15} />
                  </span>
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
              {nameRevealed && (
                <span className="onboarding-input-check">
                  <Check size={16} strokeWidth={2.6} />
                </span>
              )}
            </div>

            {error && <p className="onboarding-error">{error}</p>}

            <div className="onboarding-actions">
              <button className="onboarding-btn onboarding-btn--ghost" onClick={() => handleBack("welcome")}>
                <ArrowLeft size={15} />
                Voltar
              </button>
              <button
                className="onboarding-btn onboarding-btn--primary"
                disabled={!botName.trim()}
                onClick={handleNameNext}
              >
                Continuar
                <ArrowRight size={15} />
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
                <ArrowLeft size={15} />
                Voltar
              </button>
              <button
                className="onboarding-btn onboarding-btn--primary"
                onClick={handleCreate}
              >
                Criar {botName}
                <ArrowRight size={15} />
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
