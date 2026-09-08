# Waddle Agent OS

## Plano de transformação do `Interface-Visual---CLI`

## 1. Visão geral

Transformar o projeto atual **Interface-Visual---CLI** em uma plataforma local de agentes de IA capaz de:

- executar múltiplos agentes simultaneamente;
- permitir que agentes conversem e deleguem tarefas entre si;
- compartilhar contexto, arquivos e resultados;
- utilizar diferentes modelos e CLIs;
- executar tarefas no computador;
- controlar navegador;
- pesquisar informações;
- escrever e modificar arquivos;
- executar comandos;
- revisar o trabalho de outros agentes;
- trabalhar de forma autônoma por períodos prolongados;
- manter memória e histórico;
- executar workflows automaticamente;
- funcionar em **Linux e Windows**;
- possuir uma **interface gráfica Web acessível pelo navegador**.

A ideia não é simplesmente criar um chatbot com vários modelos.

O Waddle deverá funcionar como um **Agent OS local**.

---

# 2. Conceito central

A arquitetura deve seguir:

```text
                     WADDLE
                       │
              ┌────────▼────────┐
              │   Orchestrator  │
              └────────┬────────┘
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
   Researcher       Developer        Writer
       │               │                │
       └───────────────┼────────────────┘
                       │
                 Reviewer Agent
                       │
                 Shared Memory
                       │
                 Task Manager
                       │
                  Tool Runtime
                       │
              ┌────────┴────────┐
              │                 │
           Linux             Windows
```

O usuário fornece um objetivo de alto nível.

Exemplo:

> "Pesquise sobre IA generativa, crie 5 conteúdos para Instagram e deixe tudo organizado."

O sistema deverá:

```text
Objetivo
   ↓
Manager
   ↓
Planejamento
   ↓
Criação das tarefas
   ↓
Delegação
   ↓
Researcher
   ↓
Writer
   ↓
Reviewer
   ↓
Correções
   ↓
Artifacts
   ↓
Resultado final
```

---

# 3. Compatibilidade Linux e Windows

O Waddle deverá ser projetado desde o início para:

- Linux;
- Windows.

O **core não pode depender de APIs exclusivas de um sistema operacional**.

Diferenças específicas de Linux/Windows deverão ficar isoladas em uma camada de abstração.

```text
                 Waddle Core
                     │
             OS Abstraction Layer
                /           \
               /             \
           Linux           Windows
```

### Regra

> Nenhuma funcionalidade essencial deve depender diretamente de Linux ou Windows quando existir uma abstração multiplataforma adequada.

O projeto deverá ser testado nos dois sistemas durante o desenvolvimento.

---

# 4. Interface gráfica Web

A interface principal será uma **Web UI acessível pelo navegador**.

Não é necessário criar uma aplicação desktop nativa separada para Windows.

O Waddle funcionará como um servidor local:

```text
Linux / Windows
      │
      ▼
Waddle Runtime
      │
      ├── API
      ├── WebSocket
      ├── Agents
      ├── Tools
      ├── Memory
      ├── Scheduler
      └── Database
             │
             ▼
       localhost:PORT
             │
             ▼
          Browser
```

O usuário poderá acessar:

```text
http://localhost:PORT
```

A interface deverá permitir:

- visualizar agentes;
- iniciar/parar agentes;
- acompanhar tarefas;
- visualizar logs;
- visualizar comunicação entre agentes;
- acompanhar ferramentas utilizadas;
- aprovar ações;
- interromper execução;
- visualizar memória;
- visualizar arquivos produzidos;
- configurar modelos;
- configurar Skills;
- configurar permissões;
- configurar workflows.

A interface deverá ser responsiva e funcionar em navegadores modernos no Linux e Windows.

---

# 5. Stack proposta

## Frontend

```text
React
TypeScript
Vite
```

Possivelmente:

```text
Tailwind CSS
```

ou outro sistema de design definido posteriormente.

## Backend

```text
Python
FastAPI
WebSocket
SQLite
```

## Automação

```text
Playwright
subprocess
filesystem APIs
PTY quando necessário
```

## AI Providers

O sistema deverá possuir uma camada abstrata:

```text
ModelProvider
```

Implementações:

```text
Gemini
Claude
Codex
Qwen
Grok
Local Models
```

---

# 6. Agentes

Cada agente deverá possuir uma responsabilidade clara.

## Manager

Responsável por:

- interpretar o objetivo;
- criar plano;
- dividir tarefas;
- escolher agentes;
- delegar;
- acompanhar progresso;
- detectar falhas;
- solicitar revisão;
- consolidar resultados.

O Manager é o **orquestrador lógico**, não necessariamente o agente que executa todas as tarefas.

## Researcher

Responsável por:

- pesquisa Web;
- coleta de informações;
- análise de fontes;
- comparação;
- organização de dados;
- produção de research artifacts.

## Writer

Responsável por:

- textos;
- roteiros;
- posts;
- descrições;
- títulos;
- documentação;
- adaptação de conteúdo.

## Reviewer

Responsável por:

- revisar resultados;
- encontrar erros;
- verificar requisitos;
- identificar inconsistências;
- solicitar correções.

O Reviewer deve poder rejeitar um resultado.

```text
Writer
  ↓
Reviewer
  ↓
FAIL ──→ Writer
  │
 PASS
  ↓
Manager
```

## Developer

Responsável por:

- programação;
- debugging;
- testes;
- Git;
- arquitetura;
- implementação.

O Developer poderá utilizar **Claude Code** como backend especializado.

```text
Developer Agent
      ↓
Claude Code
      ↓
Terminal
Filesystem
Git
Tests
```

## Browser Agent

Responsável por:

- navegação;
- leitura de páginas;
- interação com sites;
- screenshots;
- preenchimento de formulários;
- automações Web.

A automação deverá priorizar Playwright e APIs estruturadas antes de mouse/teclado global.

---

# 7. Gemini como agente de desenvolvimento

O desenvolvimento do Waddle será realizado utilizando **Gemini** como agente de programação.

O Gemini não deverá receber apenas instruções genéricas como:

> "Faça o projeto."

Ele deverá operar seguindo:

```text
Rules
+
Architecture Rules
+
Skills
+
Repository Context
+
Validation
```

O objetivo é reduzir alterações destrutivas, improvisações arquiteturais e código inconsistente.

---

# 8. Skills

Skills serão uma camada central do projeto.

Uma Skill representa uma **capacidade procedural reutilizável**, contendo conhecimento, regras e um processo de execução.

Exemplos:

```text
skills/
├── architecture/
├── coding/
├── debugging/
├── frontend/
├── backend/
├── agents/
├── browser/
├── testing/
├── git/
├── security/
└── documentation/
```

Exemplos de Skills:

```text
frontend-design
backend-api
agent-development
tool-development
skill-development
debugging
testing
git-workflow
security-review
browser-automation
cross-platform
```

---

# 9. Estrutura de uma Skill

Uma Skill não deve ser apenas um prompt.

Ela deverá definir:

```text
Objetivo
Quando utilizar
Pré-requisitos
Contexto necessário
Procedimento
Ferramentas permitidas
Restrições
Critérios de sucesso
Critérios de falha
Formato de saída
```

Exemplo conceitual:

```text
SKILL: create-agent

Objetivo:
Criar um novo tipo de agente no Waddle.

Antes:
- verificar Agent base;
- verificar AgentRuntime;
- verificar Task system.

Regras:
- não duplicar runtime;
- não criar comunicação direta entre agentes;
- utilizar EventBus;
- utilizar ToolRegistry;
- registrar o agente no AgentRegistry.

Validação:
- testes unitários;
- teste de inicialização;
- teste de comunicação;
- teste de encerramento.
```

---

# 10. Skills de desenvolvimento do Gemini

O repositório deverá possuir Skills específicas para orientar o Gemini.

### `architecture-review`

Antes de mudanças estruturais:

1. mapear a arquitetura existente;
2. localizar dependências;
3. identificar pontos de extensão;
4. avaliar impacto;
5. propor alteração;
6. implementar somente depois da análise.

### `agent-development`

Regras para criação de agentes:

- herdar da abstração base;
- utilizar Runtime;
- utilizar Task System;
- utilizar EventBus;
- utilizar ToolRegistry;
- nunca criar comunicação paralela não registrada.

### `tool-development`

Toda ferramenta nova deverá:

- possuir schema de entrada;
- possuir schema de saída;
- possuir nível de risco;
- possuir permissão;
- possuir tratamento de erro;
- ser registrada no ToolRegistry;
- possuir testes.

### `cross-platform`

Toda alteração relacionada ao sistema operacional deverá ser validada em Linux e Windows.

Evitar:

- caminhos hardcoded;
- comandos exclusivos de um SO;
- dependência de shell específico;
- separadores de caminho fixos;
- APIs nativas sem abstração.

### `testing`

Depois de alterações relevantes:

```text
Implementar
   ↓
Testar
   ↓
Verificar erros
   ↓
Corrigir
   ↓
Testar novamente
```

### `security-review`

Verificar:

- credenciais;
- secrets;
- permissões;
- execução de comandos;
- acesso ao filesystem;
- ações destrutivas;
- automação Web;
- exposição da API local.

### `git-workflow`

Antes de modificar:

- verificar status;
- verificar diff;
- entender branch;
- evitar sobrescrever alterações do usuário.

Depois:

- revisar diff;
- executar testes;
- registrar mudanças relevantes.

---

# 11. Regras globais para o Gemini

## Regra 1 — Entender antes de modificar

Antes de alterar código:

```text
1. analisar arquitetura;
2. localizar componentes envolvidos;
3. verificar dependências;
4. identificar impacto;
5. somente então implementar.
```

## Regra 2 — Não reescrever sem necessidade

Nunca substituir uma arquitetura inteira apenas porque existe uma abordagem diferente.

Priorizar:

```text
refactor incremental
```

em vez de:

```text
rewrite completo
```

## Regra 3 — Preservar arquitetura

O Gemini deverá respeitar:

```text
UI
 ↓
API
 ↓
Runtime
 ↓
Agents
 ↓
Tools
 ↓
OS
```

Um agente não deve acessar diretamente componentes que deveriam passar pelo Runtime.

## Regra 4 — Ferramentas através do Tool Registry

Agentes não devem executar ferramentas arbitrariamente.

Fluxo:

```text
Agent
 ↓
Tool Registry
 ↓
Permission Check
 ↓
Tool
 ↓
Result
 ↓
Agent
```

## Regra 5 — Segurança

Nenhuma Skill poderá:

- expor credenciais;
- acessar secrets desnecessariamente;
- apagar arquivos críticos sem autorização;
- executar operações destrutivas sem política adequada;
- contornar CAPTCHA/MFA;
- publicar conteúdo externamente sem autorização apropriada.

## Regra 6 — Testar depois de modificar

Toda alteração que modificar comportamento deverá possuir validação correspondente.

## Regra 7 — Documentar decisões arquiteturais

Decisões importantes deverão ser registradas.

```text
.waddle/
└── decisions/
    ├── ADR-001-web-ui.md
    ├── ADR-002-agent-runtime.md
    └── ADR-003-tool-registry.md
```

## Regra 8 — Não inventar APIs

Se uma biblioteca, CLI, API ou ferramenta não estiver confirmada no projeto, o agente deverá verificar a documentação ou o código existente antes de utilizá-la.

## Regra 9 — Não alterar dependências sem justificativa

Novas dependências deverão:

- ter motivo claro;
- ser compatíveis com Linux e Windows;
- ser mantidas;
- não duplicar uma biblioteca existente.

## Regra 10 — Mudanças pequenas e verificáveis

Preferir alterações pequenas que possam ser testadas isoladamente.

---

# 12. Comunicação entre agentes

Agentes não deverão conversar de maneira completamente livre.

A comunicação deverá utilizar mensagens estruturadas.

```json
{
  "from": "manager",
  "to": "researcher",
  "type": "task_request",
  "task_id": "task-001",
  "content": "Pesquisar ferramentas de automação."
}
```

Tipos:

```text
task_request
task_result
task_failed
review_request
review_result
question
answer
handoff
status_update
system_event
```

---

# 13. Discussão entre agentes

O sistema poderá permitir que agentes "discutam".

Porém, isso deverá ser controlado.

Não permitir:

```text
Agent A
 ↕
Agent B
 ↕
Agent A
 ↕
Agent B
 ↕
...
```

sem limite.

A discussão deverá possuir:

- número máximo de turnos;
- limite de tokens;
- timeout;
- objetivo;
- contexto limitado;
- critério de encerramento.

Exemplo:

```text
Manager
   ↓
Researcher
   ↓
Reviewer
   ↓
Researcher
   ↓
Manager
```

---

# 14. Task Graph

Todas as tarefas deverão possuir estrutura própria.

```text
Task
├── id
├── title
├── description
├── status
├── priority
├── assigned_agent
├── dependencies
├── input
├── output
├── error
├── created_at
├── started_at
└── completed_at
```

Estados:

```text
pending
queued
running
blocked
waiting_review
completed
failed
cancelled
```

---

# 15. Event Bus

Todos os componentes importantes deverão emitir eventos.

Exemplos:

```text
task.created
task.started
task.completed
task.failed

agent.started
agent.stopped
agent.message

tool.started
tool.completed
tool.failed

approval.required

workspace.changed
```

Isso permitirá que a Web UI acompanhe tudo em tempo real.

---

# 16. Tool Registry

Ferramentas deverão ser registradas em um sistema central.

```text
ToolRegistry
├── filesystem
├── shell
├── browser
├── screenshot
├── git
├── testing
└── custom tools
```

Cada ferramenta deverá possuir:

```text
name
description
input_schema
output_schema
permission
risk_level
```

---

# 17. Ferramentas iniciais

## Filesystem

```text
read_file
write_file
list_directory
create_directory
move_file
copy_file
```

## Shell

```text
run_command
```

## Browser

```text
open_page
click
type
extract_text
screenshot
wait
```

## Development

```text
run_tests
git_diff
git_status
inspect_git
```

---

# 18. Sistema de permissões

Cada ferramenta deverá possuir nível de risco.

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Exemplo:

```text
read_file             LOW
write_file            MEDIUM
run_command           MEDIUM
install_software      HIGH
delete_files          HIGH
credential_access     CRITICAL
financial_action      CRITICAL
external_publish      HIGH
```

O sistema deverá suportar:

```text
ALLOW
ASK
DENY
```

por ferramenta e por agente.

---

# 19. Níveis de autonomia

O Waddle deverá possuir níveis configuráveis.

```text
Level 0
Assistido

Level 1
Execução automática segura

Level 2
Workflows automáticos

Level 3
Autonomia local

Level 4
Autonomia prolongada

Level 5
Autonomia quase completa
```

O usuário deverá poder definir o nível permitido.

---

# 20. Kill Switch

A interface deverá possuir:

```text
STOP ALL
```

Ao ativar:

```text
parar agentes
↓
cancelar tarefas
↓
interromper processos filhos
↓
bloquear novas ferramentas
↓
salvar estado
↓
preservar logs
```

Isso é obrigatório para modos de autonomia elevada.

---

# 21. Memória

O sistema deverá possuir:

```text
Short-Term Memory
Session Memory
Project Memory
Long-Term Memory
```

A memória deverá armazenar metadados:

```text
source
timestamp
scope
confidence
importance
```

Não armazenar tudo indiscriminadamente.

---

# 22. Workspace

Cada projeto poderá possuir:

```text
.waddle/
├── agents/
├── tasks/
├── memory/
├── artifacts/
├── logs/
├── runs/
├── decisions/
├── skills/
└── state.db
```

---

# 23. Artifacts

Agentes não deverão passar grandes quantidades de informação diretamente entre si quando um arquivo puder ser utilizado.

Exemplo:

```text
Researcher
   ↓
research.md
   ↓
Writer
```

Artifact:

```json
{
  "id": "artifact-001",
  "type": "research",
  "path": ".waddle/artifacts/research-001.md",
  "created_by": "researcher",
  "task_id": "task-001"
}
```

---

# 24. Scheduler

O Waddle deverá futuramente executar tarefas sem interação direta.

```text
Scheduler
    ↓
Task Queue
    ↓
Manager
    ↓
Agents
```

Exemplo:

```text
Todo dia às 08:00
      ↓
Pesquisar notícias de IA
      ↓
Selecionar assuntos
      ↓
Criar conteúdo
      ↓
Revisar
      ↓
Salvar
```

---

# 25. Runtime independente da interface

A UI não será responsável pela execução dos agentes.

```text
Browser UI
     │
     ▼
API
     │
     ▼
Waddle Runtime
```

Isso permitirá:

- fechar o navegador;
- reiniciar a interface;
- continuar tarefas;
- executar em background;
- futuramente acessar remotamente;
- criar outras interfaces.

---

# 26. Arquitetura final

```text
                        Browser
                           │
                           ▼
                     Web Interface
                           │
                      HTTP/WebSocket
                           │
                           ▼
                    Waddle API Layer
                           │
                           ▼
                  Agent Orchestrator
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
       Manager         Task Manager     Scheduler
          │
          ▼
     Agent Runtime
          │
    ┌─────┼─────────────┐
    ▼     ▼             ▼
Research Writer      Developer
                       │
                   Claude Code
          │
          ▼
      Tool Runtime
          │
     Tool Registry
          │
 ┌────────┼───────────┐
 ▼        ▼           ▼
Files   Browser      Shell
          │
          ▼
    OS Abstraction
       /       \
    Linux     Windows
```

---

# 27. Estrutura de código

```text
src/
└── waddle/
    ├── app/
    │   ├── application.py
    │   └── lifecycle.py
    │
    ├── api/
    │   ├── server.py
    │   ├── routes/
    │   └── websocket.py
    │
    ├── agents/
    │   ├── base.py
    │   ├── manager.py
    │   ├── researcher.py
    │   ├── writer.py
    │   ├── reviewer.py
    │   ├── developer.py
    │   └── browser.py
    │
    ├── runtime/
    │   ├── agent_runtime.py
    │   ├── task_runtime.py
    │   ├── scheduler.py
    │   └── event_bus.py
    │
    ├── models/
    │   ├── base.py
    │   ├── gemini.py
    │   ├── claude.py
    │   ├── codex.py
    │   └── qwen.py
    │
    ├── tools/
    │   ├── registry.py
    │   ├── filesystem.py
    │   ├── shell.py
    │   ├── browser.py
    │   └── screenshot.py
    │
    ├── memory/
    │   ├── store.py
    │   ├── context.py
    │   └── retrieval.py
    │
    ├── tasks/
    │   ├── task.py
    │   ├── manager.py
    │   └── graph.py
    │
    ├── policies/
    │   ├── permissions.py
    │   └── approvals.py
    │
    ├── storage/
    │   └── database.py
    │
    └── skills/
        ├── loader.py
        ├── registry.py
        └── validator.py

web/
├── src/
├── components/
├── pages/
├── stores/
└── services/
```

---

# 28. Skills do próprio Waddle

Além das Skills usadas pelo Gemini durante desenvolvimento, o **próprio Waddle deverá ter suporte a Skills**.

Existirão duas camadas:

```text
                DEVELOPMENT
                     │
              Gemini Skills
                     │
                     ▼
              desenvolvem Waddle
```

E:

```text
                  WADDLE
                     │
               Agent Skills
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Research      Content       Coding
```

Assim, o Gemini poderá desenvolver novas Skills para o próprio Waddle.

---

# 29. Workflow de conteúdo

Exemplo:

```text
Usuário
"Crie 5 conteúdos sobre IA para esta semana."
        │
        ▼
     Manager
        │
        ▼
   Task Graph
        │
        ├──── Researcher
        │
        ├──── Writer
        │
        └──── Reviewer
                  │
             ┌────┴────┐
             │         │
           FAIL       PASS
             │         │
             ▼         ▼
           Writer    Manager
                       │
                       ▼
                   Artifacts
```

---

# 30. Workflow de desenvolvimento

```text
Usuário
   ↓
Manager
   ↓
Architect
   ↓
Developer
   ↓
Claude Code
   ↓
Tests
   ↓
Reviewer
   │
   ├── FAIL → Developer
   │
   └── PASS
          ↓
       Complete
```

---

# 31. Observabilidade

A Web UI deverá mostrar:

## Agents

```text
Manager       RUNNING
Researcher    WORKING
Writer        WAITING
Reviewer      IDLE
Developer     WORKING
```

## Tasks

```text
Pending
Running
Review
Completed
Failed
```

## Activity

```text
09:31 Manager created task
09:32 Researcher started
09:34 Researcher created artifact
09:35 Writer started
09:39 Reviewer rejected draft
09:40 Writer correcting
```

---

# 32. Auditoria

Todas as ações importantes deverão ser registradas.

O sistema deverá conseguir responder:

```text
Quem executou?
Quando?
Qual tarefa?
Qual ferramenta?
Qual input?
Qual resultado?
Qual erro?
Quantas tentativas?
```

SQLite deverá evoluir para tabelas como:

```text
agents
tasks
messages
tool_calls
artifacts
runs
approvals
errors
events
skills
```

---

# 33. Recuperação de falhas

O Runtime deverá tratar falhas de maneira estruturada.

Exemplo:

```text
Agent
 ↓
Task
 ↓
Tool Error
 ↓
Runtime
 ↓
Retry?
 ├── YES → retry
 ├── REASSIGN → outro agente
 ├── ASK → usuário
 └── FAIL → registrar
```

Cada tarefa deverá possuir limite de tentativas para evitar loops infinitos.

---

# 34. CAPTCHAs, MFA e autenticação

O sistema não deverá tentar contornar mecanismos de autenticação ou CAPTCHA.

Quando uma ação exigir intervenção:

```text
Agent
 ↓
Browser
 ↓
Authentication Barrier
 ↓
approval.required
 ↓
Usuário assume controle
 ↓
Agent continua
```

---

# 35. Background Runtime

O Runtime deverá funcionar independentemente da Web UI.

```text
Waddle Runtime
      │
      ├── Agent Runtime
      ├── Scheduler
      ├── Task Queue
      ├── Memory
      ├── Database
      └── Tool Runtime

             ▲
             │
        HTTP/WebSocket
             │
             ▼
          Browser
```

No futuro, o runtime poderá continuar trabalhando mesmo que o usuário feche o navegador.

---

# 36. Multi-Model

Os agentes não deverão ficar presos a um único fornecedor.

Exemplo:

```text
Manager
   ↓
Gemini

Researcher
   ↓
Gemini

Developer
   ↓
Claude Code

Reviewer
   ↓
Gemini

Local Agent
   ↓
Local Model
```

A seleção poderá futuramente ser dinâmica.

Exemplo:

```text
Tarefa simples → modelo barato
Tarefa complexa → modelo avançado
Código → Claude Code
Pesquisa → modelo com ferramentas Web
```

---

# 37. MCP

MCP deverá ser utilizado quando fizer sentido para integrações externas ou ferramentas maduras.

Exemplos:

```text
GitHub
Notion
Browser
serviços externos
```

Não utilizar MCP para absolutamente tudo.

Regra:

> Ferramentas internas simples devem permanecer no Tool Registry. MCP deve ser utilizado principalmente quando a integração externa ou reutilização justificar sua complexidade.

---

# 38. Roadmap

## Fase 0 — Auditoria

Analisar profundamente o código atual do:

```text
Interface-Visual---CLI
```

Não reescrever imediatamente.

Identificar:

- controller;
- PTY;
- sessões;
- SQLite;
- configuração;
- integração com CLIs;
- UI existente.

---

## Fase 1 — Agent Core

Criar:

```text
Agent
AgentRuntime
Task
TaskManager
EventBus
```

Primeiro teste:

```text
Manager
   ↓
Worker
   ↓
Result
   ↓
Manager
```

---

## Fase 2 — Multi-Agent

Criar:

```text
Manager
Researcher
Writer
Reviewer
```

---

## Fase 3 — Tool System

Implementar:

```text
ToolRegistry
Permissions
Filesystem
Shell
```

---

## Fase 4 — Skills

Implementar:

```text
Skill
SkillRegistry
SkillLoader
SkillValidator
```

Permitir:

```text
install
enable
disable
update
version
```

---

## Fase 5 — Memory

Implementar:

```text
Session Memory
Project Memory
Long-Term Memory
```

---

## Fase 6 — Web UI

Migrar a:

```text
React
TypeScript
WebSocket
```

Criar:

- Dashboard;
- Agent Monitor;
- Task Board;
- Activity Timeline;
- Agent Inspector;
- Skill Manager;
- Tool Manager;
- Settings;
- Approval Center.

---

## Fase 7 — Claude Code

Integrar:

```text
Developer Agent
      ↓
Claude Code
```

---

## Fase 8 — Browser

Adicionar:

```text
Playwright
```

---

## Fase 9 — Autonomia

Implementar:

```text
Scheduler
Background Runtime
Retry
Recovery
Task Queue
```

---

## Fase 10 — Multi-Model

Adicionar:

```text
Gemini
Claude
Codex
Qwen
Grok
Local
```

com seleção dinâmica de modelo.

---

# 39. MVP

O primeiro MVP não deverá tentar fazer tudo.

Deverá possuir:

```text
Web UI
+
Manager
+
Researcher
+
Writer
+
Reviewer
+
Task System
+
Event Bus
+
Tool Registry
+
Filesystem
+
SQLite
+
Skills
+
Logs
+
Kill Switch
```

Workflow obrigatório:

```text
Manager
   ↓
Researcher
   ↓
Writer
   ↓
Reviewer
   ↓
Correção
   ↓
Resultado
```

---

# 40. Critérios de sucesso do MVP

O MVP será considerado funcional quando conseguir:

1. receber um objetivo do usuário;
2. criar um plano;
3. dividir o objetivo em tarefas;
4. selecionar agentes;
5. executar agentes;
6. compartilhar contexto;
7. trocar mensagens estruturadas;
8. utilizar ferramentas;
9. criar artifacts;
10. revisar resultados;
11. detectar uma falha;
12. solicitar correção;
13. finalizar o workflow;
14. registrar tudo no histórico;
15. permitir interromper a execução;
16. funcionar em Linux;
17. funcionar em Windows;
18. ser controlado pelo navegador.

---

# 41. Princípio arquitetural

```text
MODEL
= raciocínio

AGENT
= especialização

SKILL
= procedimento + regras

ORCHESTRATOR
= coordenação

TASK
= trabalho

TOOL
= ação

MEMORY
= contexto persistente

EVENT BUS
= comunicação

POLICY
= limites

RUNTIME
= autonomia

WEB UI
= observabilidade + controle
```

---

# 42. Regra principal do projeto

O Waddle deverá sempre seguir:

```text
PLAN
 ↓
EXECUTE
 ↓
OBSERVE
 ↓
VALIDATE
 ↓
CORRECT
 ↓
COLLABORATE
 ↓
CONCLUDE
```

Filosofia:

> **A inteligência vem dos modelos. A especialização vem dos agentes e Skills. A confiabilidade vem da arquitetura. A autonomia vem do Runtime. A segurança vem das Policies. A interface Web permite observar e controlar tudo.**

---

# 43. Decisão arquitetural principal

**Não reconstruir o `Interface-Visual---CLI` do zero.**

Utilizar o projeto existente como fundação e fazer uma migração incremental:

```text
Interface-Visual---CLI
        ↓
      Refactor
        ↓
 Waddle Runtime
        ↓
    Agent OS
        ↓
     Web UI
```

O código atual deve ser reaproveitado sempre que cumprir os novos requisitos, especialmente:

- PTY;
- sessões;
- histórico;
- SQLite;
- configuração;
- integração com CLIs.

---

# 44. Primeira sprint recomendada

A primeira sprint deverá ser deliberadamente pequena.

### Objetivo

Provar que o Waddle consegue executar uma arquitetura multiagente básica.

Implementar:

```text
Agent
Task
AgentRuntime
TaskManager
EventBus
```

Criar somente:

```text
Manager
Worker
```

Fluxo:

```text
User
 ↓
Manager
 ↓
Task
 ↓
Worker
 ↓
Result
 ↓
Manager
 ↓
Web UI
```

Ferramentas iniciais:

```text
read_file
write_file
run_command
```

Interface mínima:

```text
Agents
Tasks
Activity
Stop All
```

Somente depois disso começar a adicionar Researcher, Writer, Reviewer, Browser, Scheduler e demais componentes.

---

# 45. Princípio de desenvolvimento

O Gemini deverá desenvolver o Waddle seguindo:

```text
Entender
   ↓
Planejar
   ↓
Alterar
   ↓
Testar
   ↓
Revisar
   ↓
Documentar
```

Nunca:

```text
Prompt
 ↓
Rewrite tudo
 ↓
Torcer para funcionar
```

O objetivo é construir gradualmente um **Agent OS local, multiplataforma, extensível e observável**, utilizando o `Interface-Visual---CLI` como ponto de partida.
