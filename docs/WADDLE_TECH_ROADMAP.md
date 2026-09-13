# Waddle Agent OS — Roadmap técnico por referências

## Status

Proposto em 2026-09-13.

Este documento organiza a curadoria de projetos que mais combinam com a direção do Waddle. A intenção não é transformar o Waddle em uma skin sobre outro framework, e sim escolher referências e dependências pequenas que fortaleçam a arquitetura atual.

## Como usar este roadmap

- Use este arquivo para decidir o próximo slice técnico do Waddle.
- Antes de adicionar uma dependência, valide se ela resolve um problema real do projeto.
- Prefira integrar por camadas finas e substituíveis.
- Quando uma escolha virar arquitetura estável, registre uma ADR separada em `docs/`.

## Norte do produto

O Waddle deve evoluir para um Agent OS local com:

- agentes com identidade, estado e memória;
- orquestração de tarefas entre agentes;
- ferramentas locais e externas plugáveis;
- browser automation;
- memória semântica e procedural;
- UI rica para acompanhar execução, artefatos e decisões;
- execução local primeiro, com provedores externos opcionais.

Arquitetura conceitual:

```text
                    WADDLE
                       │
          ┌────────────┴─────────────┐
          │                          │
       AGENTS                     RUNTIME
          │                          │
      Soul                        Scheduler
      Memory                      Permissions
      Skills                      Tasks
      Context
          │
          ▼
      sqlite-vec
          │
          ▼
    ContextBuilder

          AGENTS
             │
        ToolRegistry
             │
       ┌─────┼────────────┐
       │     │            │
      MCP  Playwright   Nango
       │     │            │
   plugins browser    integrations

             │
             ▼
           OpenUI
             │
             ▼
        Waddle Client
```

## Fases recomendadas

### Fase 1 — Memória local útil

Objetivo: dar ao Waddle memória pesquisável sem depender de serviço externo.

Projetos principais:

| Projeto | Uso no Waddle | Prioridade |
| --- | --- | --- |
| [sqlite-vec](https://github.com/asg017/sqlite-vec) | Busca vetorial local, embeddings e RAG em cima de SQLite. | Alta |
| [Mem0](https://github.com/mem0ai/mem0) | Referência futura para memória persistente por usuário/agente. | Média |

Encaixe:

```text
SQLite
  ↓
sqlite-vec
  ↓
Memory Retrieval
  ↓
Knowledge Retrieval
  ↓
ContextBuilder
```

Entregas pequenas:

1. Criar um `MemoryRepository` isolado do runtime.
2. Indexar notas locais em SQLite.
3. Expor busca textual simples primeiro.
4. Adicionar embeddings e `sqlite-vec` depois da base estar estável.
5. Mostrar memórias recuperadas na UI antes de injetar automaticamente no prompt.

Relação com docs existentes:

- Complementa `docs/PLANO_AI_MEMORY.md`.

### Fase 2 — Skills e memória procedural

Objetivo: fazer agentes carregarem procedimentos sob demanda, sem inflar o prompt base.

Projetos principais:

| Projeto | Uso no Waddle | Prioridade |
| --- | --- | --- |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) | Referência para `SKILL.md`, progressive disclosure e skill loading. | Alta |
| [agent-skills](https://github.com/addyosmani/agent-skills) | Biblioteca e padrões de skills reaproveitáveis. | Alta |

Encaixe:

```text
Skill Index
  ↓
Skill Loader
  ↓
SKILL.md
  ↓
ToolRegistry
  ↓
Permission Layer
```

Entregas pequenas:

1. Definir formato mínimo de skill do Waddle.
2. Criar índice local de skills.
3. Carregar skill por intenção explícita do usuário.
4. Registrar no log quando uma skill influenciar uma ação.
5. Só depois permitir auto-seleção por agente.

### Fase 3 — Tools, plugins e integrações

Objetivo: padronizar ferramentas internas e externas sem acoplar tudo ao core.

Projetos principais:

| Projeto | Uso no Waddle | Prioridade |
| --- | --- | --- |
| [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) | Cliente/servidor MCP, tools, resources e prompts. | Alta |
| [Nango](https://github.com/NangoHQ/nango) | OAuth, refresh tokens, webhooks e integrações externas. | Alta |

Encaixe:

```text
Waddle ToolRegistry
├── Native Tools
└── MCP Client
     ├── GitHub
     ├── Files
     ├── Database
     └── outros
```

Entregas pequenas:

1. Criar contratos internos de `Tool`, `ToolResult` e permissões.
2. Adaptar tools nativas atuais para esse contrato.
3. Adicionar MCP como adaptador, não como runtime central.
4. Deixar Nango como camada futura para plugins com OAuth.

### Fase 4 — Browser e computer use

Objetivo: permitir que agentes usem navegador de forma controlada e verificável.

Projetos principais:

| Projeto | Uso no Waddle | Prioridade |
| --- | --- | --- |
| [Playwright Python](https://github.com/microsoft/playwright-python) | Browser automation determinística: DOM, click, fill, screenshots. | Alta |
| [Browser Use](https://github.com/browser-use/browser-use) | Referência para agente de navegador autônomo. | Média |
| [Open Interpreter](https://github.com/openinterpreter/openinterpreter) | Referência arquitetural para execução local, permissões e computer use. | Média |

Encaixe:

```text
BrowserTool
├── deterministic → Playwright
└── autonomous → Browser Use
```

Entregas pequenas:

1. Começar com Playwright determinístico.
2. Registrar screenshots e ações no histórico.
3. Exigir aprovação para ações sensíveis.
4. Separar navegação autônoma em modo experimental.

### Fase 5 — Generative UI e UX de resultados

Objetivo: fazer respostas dos agentes virarem componentes úteis, não apenas texto.

Projetos principais:

| Projeto | Uso no Waddle | Prioridade |
| --- | --- | --- |
| [OpenUI](https://github.com/thesysdev/openui) | Referência para UI gerada por agentes e renderer controlado. | Alta |
| [LibreChat](https://github.com/danny-avila/LibreChat) | Referência de produto para chat multi-modelo, anexos e histórico. | Média |

Encaixe:

```text
ConversationView
├── Markdown
└── GenerativeUI
```

Exemplos de componentes por agente:

| Agente | Componente possível |
| --- | --- |
| Quinta | `TaskPlan` |
| Atlas | `SourceCard` / `ResearchSummary` |
| Nero | `TestResult` / `ImplementationSummary` |
| Iris | `ReviewSummary` / `RiskCard` |
| Ma | `StockCard` / `PortfolioCard` |
| Livro | `MatchCard` |

Entregas pequenas:

1. Consolidar o renderer atual de `web/src/waddle-ui`.
2. Definir schemas de componentes gerados.
3. Renderizar componentes apenas a partir de JSON validado.
4. Manter fallback em Markdown.

### Fase 6 — Multi-agent e orquestração

Objetivo: fazer agentes colaborarem com handoff, debate e revisão sem perder controle.

Projetos principais:

| Projeto | Uso no Waddle | Prioridade |
| --- | --- | --- |
| [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) | Referência para workflows, handoffs, checkpoints e human-in-the-loop. | Média |
| [TradingAgents](https://github.com/TauricResearch/TradingAgents) | Referência para debate multiagente especializado. | Média-alta |
| [Pydantic AI](https://github.com/pydantic/pydantic-ai) | Structured output, schemas, validação e tool calling tipado. | Média-alta |

Entregas pequenas:

1. Formalizar `Task`, `Subtask`, `Handoff` e `AgentRun`.
2. Fazer Quinta planejar e delegar com schemas.
3. Fazer Iris revisar antes de marcar como concluído.
4. Adicionar rodadas de crítica apenas quando melhorarem o resultado.
5. Persistir checkpoints para retomar sessão.

### Fase 7 — Domínios especializados

Objetivo: enriquecer agentes específicos sem poluir o core.

Projetos por domínio:

| Projeto | Domínio | Uso no Waddle | Prioridade |
| --- | --- | --- | --- |
| [Fincept Terminal](https://github.com/Fincept-Corporation/FinceptTerminal) | Finanças | Referência para Ma: dados de mercado, risco, dashboards. | Média |
| [Flowsint](https://github.com/reconurge/flowsint) | Pesquisa/OSINT | Referência para knowledge graph, entidades, relações e enrichers. | Alta como referência |
| [Agentic Inbox](https://github.com/cloudflare/agentic-inbox) | Email | Referência para agente de inbox, routing e attachments. | Média |
| [VoxCPM](https://github.com/OpenBMB/VoxCPM) | Voz | Futuro sistema de vozes dos agentes. | Baixa |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | Vídeo | Futuro agente de mídia. | Baixa |
| [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | Vídeo curto | Futuro pipeline de conteúdo. | Baixa |

## Ordem prática de execução

### Agora

1. `sqlite-vec`
2. Hermes Agent / padrão de Skills
3. `agent-skills`
4. MCP Python SDK
5. Nango
6. Playwright
7. OpenUI

### Estudar logo

8. Browser Use
9. Flowsint
10. Pydantic AI
11. TradingAgents
12. Fincept Terminal
13. Open Interpreter

### Referência de produto/arquitetura

14. LibreChat
15. Microsoft Agent Framework
16. Agentic Inbox

### Depois

17. VoxCPM
18. HyperFrames
19. MoneyPrinterTurbo
20. LiteLLM

## Projetos essenciais, se precisar reduzir

Se for necessário focar em poucos projetos:

1. [sqlite-vec](https://github.com/asg017/sqlite-vec)
2. [Hermes Agent](https://github.com/NousResearch/hermes-agent)
3. [agent-skills](https://github.com/addyosmani/agent-skills)
4. [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
5. [Nango](https://github.com/NangoHQ/nango)
6. [Playwright Python](https://github.com/microsoft/playwright-python)
7. [OpenUI](https://github.com/thesysdev/openui)
8. [Flowsint](https://github.com/reconurge/flowsint)

## Regra de adoção de dependência

Antes de integrar qualquer projeto deste roadmap:

1. definir o problema concreto que ele resolve;
2. criar um slice pequeno;
3. proteger por interface/adaptador;
4. validar com teste local;
5. documentar a decisão se a dependência virar parte estrutural;
6. evitar dependências que substituam o Waddle inteiro por outro framework.

## Próximo slice recomendado

Começar por memória local:

```text
MemoryRepository
  ↓
SQLite tables
  ↓
Text search
  ↓
ContextBuilder preview
  ↓
sqlite-vec
```

Critério de aceite inicial:

- o usuário consegue registrar uma nota de memória;
- o agente consegue buscar notas relevantes;
- a UI mostra quais memórias foram recuperadas;
- nada é injetado automaticamente no prompt sem ficar visível para o usuário.
