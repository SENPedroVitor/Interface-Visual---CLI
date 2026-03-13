import { useCallback, useEffect, useRef, useState } from "react";
import { getCoreClient } from "./core";

type Message = {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  meta?: string;
};

const BACKENDS = ["codex", "qwen"] as const;
const STARTER_PROMPTS = [
  "Me ajude a organizar este projeto.",
  "Quero integrar um novo comando CLI.",
  "Analise esta pasta e proponha os proximos passos."
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Bom dia";
  }
  if (hour < 18) {
    return "Boa tarde";
  }
  return "Boa noite";
}

function getBackendLabel(backend: (typeof BACKENDS)[number]) {
  return backend === "codex" ? "Codex" : "Qwen";
}

export default function App() {
  const coreRef = useRef(getCoreClient());
  const core = coreRef.current;
  const [backend, setBackend] = useState<(typeof BACKENDS)[number]>("codex");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [bridgeStatus, setBridgeStatus] = useState<
    "ready" | "degraded" | "missing"
  >(core.available ? "ready" : "missing");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const backendRef = useRef(backend);
  const greeting = getGreeting();
  const canSend = core.available && bridgeStatus === "ready";

  useEffect(() => {
    backendRef.current = backend;
  }, [backend]);

  const connectBackend = useCallback(() => {
    if (!core.available) {
      setBridgeStatus("missing");
      return;
    }

    core
      .start(backend)
      .then(() => {
        setBridgeStatus("ready");
      })
      .catch(() => {
        setBridgeStatus("degraded");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content:
              "A interface abriu, mas a bridge nao conseguiu iniciar o backend CLI.",
            meta: "Sistema"
          }
        ]);
      });
  }, [backend, core]);

  useEffect(() => {
    if (!core.available) {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "system",
          content:
            "A interface abriu sem a bridge nativa. O shell visual esta funcionando, mas o chat ainda nao esta conectado ao processo Electron.",
          meta: "Sistema"
        }
      ]);
      return;
    }

    connectBackend();
  }, [connectBackend, core]);

  useEffect(() => {
    const unsub = core.onOutput((payload) => {
      if (!payload || typeof payload !== "object") {
        return;
      }
      const data = (payload as { type?: string; data?: string }).data;
      if (!data) {
        return;
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "ai") {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + data }
          ];
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "ai",
            content: data,
            meta: getBackendLabel(backendRef.current)
          }
        ];
      });
    });
    return () => {
      unsub();
    };
  }, [core]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) {
      return;
    }
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text, meta: "Você" }
    ]);
    setInput("");
    core.send(text + "\n").catch(() => {
      setBridgeStatus("degraded");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content:
            "Falha ao enviar para o backend. Verifique se o processo principal conseguiu subir a bridge Python.",
          meta: "Sistema"
        }
      ]);
    });
  };

  const quickCommands = [
    { label: "/model", value: "/model\n" },
    { label: "/reset", value: "/reset\n" },
    { label: "/history", value: "/history\n" }
  ];

  return (
    <div className="app">
      <div className="app__bg" aria-hidden />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__dot" />
          <div>
            <div className="brand__title">Osaurus-like</div>
            <div className="brand__subtitle">CLI desktop shell</div>
          </div>
        </div>
        <div className="panel">
          <div className="panel__title">Escolha o CLI</div>
          {BACKENDS.map((name) => (
            <button
              key={name}
              className={`pill ${backend === name ? "is-active" : ""}`}
              onClick={() => setBackend(name)}
            >
              {getBackendLabel(name)}
            </button>
          ))}
        </div>
        <div className="panel">
          <div className="panel__title">Status</div>
          <div className={`status status--${bridgeStatus}`}>
            {bridgeStatus === "ready" && "Bridge conectada"}
            {bridgeStatus === "degraded" && "Bridge com falha"}
            {bridgeStatus === "missing" && "Bridge indisponivel"}
          </div>
          <div className="integration-copy">
            {bridgeStatus === "ready" &&
              "O app ja pode enviar prompts para o CLI selecionado."}
            {bridgeStatus === "degraded" &&
              "A UI abriu, mas o processo Python ou o agente CLI nao respondeu corretamente."}
            {bridgeStatus === "missing" &&
              "A shell visual abriu sem a bridge do Electron. O app ainda nao consegue falar com o CLI."}
          </div>
          <button className="send send--secondary" onClick={connectBackend}>
            {bridgeStatus === "ready" ? "Reconectar" : "Conectar bridge"}
          </button>
        </div>
        <div className="panel">
          <div className="panel__title">Como usar</div>
          <div className="session">
            <div className="session__title">1. Escolha um agente</div>
            <div className="session__meta">Codex ou Qwen</div>
          </div>
          <div className="session">
            <div className="session__title">2. Conecte a bridge</div>
            <div className="session__meta">O app abre a sessao persistente</div>
          </div>
          <div className="session">
            <div className="session__title">3. Envie seu prompt</div>
            <div className="session__meta">A resposta aparece em streaming</div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="topbar__title">
              {greeting}. Vamos conversar com {getBackendLabel(backend)}.
            </div>
            <div className="topbar__subtitle">
              Escolha o CLI, conecte e comece a conversa pela caixa de prompt.
            </div>
          </div>
          <div className="topbar__actions">
            {quickCommands.map((cmd) => (
              <button
                key={cmd.label}
                className="ghost"
                disabled={!canSend}
                onClick={() => {
                  core.send(cmd.value).catch(() => {
                    setBridgeStatus("degraded");
                  });
                }}
              >
                {cmd.label}
              </button>
            ))}
          </div>
        </header>

        <section className="chat">
          <div className="hero-card">
            <div>
              <div className="hero-card__eyebrow">{greeting}</div>
              <div className="hero-card__title">
                Escolha seu CLI e comece a conversa agora.
              </div>
              <div className="hero-card__copy">
                O app fala com {getBackendLabel(backend)} por uma bridge Python
                e mantem a sessao ativa, num fluxo mais proximo do Osaurus.
              </div>
            </div>
            <div className="hero-card__actions">
              <button className="send" onClick={connectBackend}>
                Conectar {getBackendLabel(backend)}
              </button>
              <div className="hero-card__hint">
                Depois disso, digite no campo abaixo e pressione Enter.
              </div>
            </div>
          </div>
          {!messages.length && (
            <div className="starter-grid">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="starter-card"
                  onClick={() => setInput(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          {messages.map((message) => (
            <div key={message.id} className={`message is-${message.role}`}>
              <div className="message__bubble">{message.content}</div>
              <div className="message__meta">
                {message.meta || (message.role === "user" ? "Você" : getBackendLabel(backend))}
              </div>
            </div>
          ))}
          {!messages.length && (
            <div className="message is-ai">
              <div className="message__bubble">
                A resposta do agente vai aparecer aqui em streaming assim que voce enviar o primeiro prompt.
              </div>
              <div className="message__meta">Sistema</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </section>

        <footer className="composer">
          <div className="composer__hint">
            Enter envia. Shift+Enter cria uma nova linha.
          </div>
          <label className="composer__label" htmlFor="agent-prompt">
            Prompt para o agente
          </label>
          <div className="composer__row">
            <textarea
              id="agent-prompt"
              className="composer__input"
              placeholder={`Comece a conversa com ${getBackendLabel(backend)}...`}
              value={input}
              disabled={!canSend}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              rows={2}
            />
            <button className="send" onClick={send} disabled={!canSend}>
              Enviar para {getBackendLabel(backend)}
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
