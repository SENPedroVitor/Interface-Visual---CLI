import React, { useState, useEffect, useCallback } from "react";
import { WaddleAvatar } from "./WaddleAvatar";
import type { AgentState } from "./WaddleAvatar";
import { Highlighter } from "./Highlighter";
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

/* ── Mystery avatar flip ────────────────────────────────────── */
function MysteryAvatar({ revealed, size }: { revealed: boolean; size: number }) {
  return (
    <div
      className={`onboarding-mystery-wrap ${revealed ? "is-revealed" : ""}`}
      style={{ width: size, height: size }}
    >
      <div className="onboarding-mystery-side onboarding-mystery-front">
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
          <rect x="14" y="30" width="72" height="42" rx="21" fill="#d1d5db" />
          <text
            x="50" y="58"
            textAnchor="middle"
            fontSize="28"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
            fill="#6b7280"
          >?</text>
        </svg>
      </div>
      <div className="onboarding-mystery-side onboarding-mystery-back">
        <WaddleAvatar
          imageUrl="/avatars/chefe.png"
          color="#2d1b4e"
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
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHighlightReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  const selectedOption = TITLE_OPTIONS.find((o) => o.key === selectedTitle)!;
  const nameRevealed = botName.trim().length >= 1;

  /* Spin avatar briefly, then run callback */
  const withSpin = useCallback((cb: () => void, delay = 500) => {
    setSpinning(true);
    setTimeout(() => {
      setSpinning(false);
      cb();
    }, delay);
  }, []);

  const handleStartClick = () => withSpin(() => setStep("name"), 700);

  const handleNameNext = () => {
    if (!botName.trim()) {
      setError("Dê um nome ao seu bot antes de continuar.");
      setWobble(true);
      setTimeout(() => setWobble(false), 600);
      return;
    }
    withSpin(() => setStep("title"), 400);
  };

  const handleBack = (to: Step) => withSpin(() => setStep(to), 300);

  const handleCreate = async () => {
    withSpin(async () => {
      setStep("creating");
      try {
        await createAgent({
          name: botName.trim(),
          role: "Manager",
          description: `Bot ${selectedTitle} criado no onboarding. Coordena os outros agentes da equipe.`,
        });
      } catch (_) {
        // Agent already exists or any error — just proceed
      }
      localStorage.setItem(ONBOARDING_KEY, "true");
      onComplete();
    }, 500);
  };

  return (
    <div className="onboarding-root">
      <div className="onboarding-card">

        {/* ── Welcome ── */}
        {step === "welcome" && (
          <div className="onboarding-step onboarding-step--welcome">
            <div className={`onboarding-mascot ${spinning ? "is-spinning" : ""}`}>
              <WaddleAvatar
                imageUrl="/avatars/chefe.png"
                color="#2d1b4e"
                state="idle"
                size={110}
                trackMouse
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
              disabled={spinning}
            >
              Começar
            </button>
          </div>
        )}

        {/* ── Name ── */}
        {step === "name" && (
          <div className="onboarding-step">
            <div className={`onboarding-mascot ${spinning ? "is-spinning" : ""}`}>
              <MysteryAvatar revealed={nameRevealed} size={90} />
            </div>

            <h2 className="onboarding-heading">
              Como vai se chamar<br />seu bot chefe?
            </h2>

            <p className="onboarding-hint">
              {nameRevealed
                ? "Boa escolha! Ele vai adorar esse nome."
                : "Digite o nome para revelar seu bot."}
            </p>

            <div className={`onboarding-input-wrap ${wobble ? "wobble" : ""}`}>
              <input
                className="onboarding-input"
                type="text"
                placeholder="Ex: Quinta, Atlas, Max…"
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
                disabled={!botName.trim() || spinning}
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
            <div className={`onboarding-mascot ${spinning ? "is-spinning" : ""}`}>
              <WaddleAvatar
                key={selectedTitle}
                imageUrl="/avatars/chefe.png"
                color="#2d1b4e"
                state={selectedOption.state}
                size={90}
              />
            </div>

            <h2 className="onboarding-heading">
              Qual é o papel do{" "}
              <strong style={{ color: selectedOption.color }}>{botName}</strong>?
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
                disabled={spinning}
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
              imageUrl="/avatars/chefe.png"
              color="#2d1b4e"
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
