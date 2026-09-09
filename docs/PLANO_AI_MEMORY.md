# Plano de Arquitetura e Implementação: Memória de IA (Baseada no ai-memory de Akita on Rails) no Waddle Agent OS

Documento de especificação técnica para a adaptação do modelo de memória de longo prazo do [akitaonrails/ai-memory](https://github.com/akitaonrails/ai-memory) ao **Waddle Agent OS**.

A solução integra a filosofia da **Wiki LLM no estilo Karpathy** (arquivos `.md` no disco como fonte da verdade) a um **índice derivado SQLite FTS5**, **observação silenciosa de ciclo de vida**, **protocolo de handoff entre agentes** e uma **interface visual dedicada no React**.

---

## 1. Visão Geral e Filosofia

No projeto original do Akita (`ai-memory`), agentes de desenvolvimento compartilham um conhecimento duradouro que transcende trocas de agentes, sessões e computadores:

1. **Wiki Karpathy em Markdown**:
   - O conhecimento reside em arquivos Markdown puros (`.md`), organizados semanticamente em diretórios:
     - `_rules/`: Regras, restrições e convenções de projeto que os agentes devem sempre respeitar.
     - `decisions/`: Escolhas técnicas, padrões arquiteturais e decisões de produto consolidadas.
     - `gotchas/`: Armadilhas, bugs conhecidos, limitações de bibliotecas e soluções de contorno.
     - `concepts/`: Modelos mentais, glossário de domínio e estruturas do sistema.
     - `procedures/`: Passo a passo e Procedimentos Operacionais Padrão (POPs) reutilizáveis.
     - `sessions/`: Registros consolidados de sessões e tarefas executadas anteriormente.
     - `log.md`: Diário cronológico append-only de observações da equipe de agentes.
   - Os arquivos podem ser editados no VS Code ou Obsidian, versionados no Git e copiados livremente.

2. **Índice Derivado SQLite FTS5**:
   - O SQLite funciona como um índice derivado de alta performance com FTS5 (busca textual completa ponderada), contadores de acesso (`access_count`) e decaimento temporal (`retention`).
   - Se o banco de dados for apagado, ele é reconstruído automaticamente lendo os arquivos `.md` do disco.

3. **Observação Silenciosa de Ciclo de Vida**:
   - Os eventos da sessão (prompts do usuário, execução de ferramentas, opiniões, erros e conclusão de tarefas) são interceptados de forma desacoplada via `EventBus` e gravados sem bloquear o fluxo de execução.

4. **Consolidação de Sessão**:
   - Ao final de um run, o sistema analisa os eventos e sintetiza uma página em `sessions/<run_id>.md`. Se ocorreram falhas corrigidas, gera propostas de `gotchas/`.

5. **Protocolo de Handoff entre Agentes**:
   - Mecanismo formal de passagem de bastão com campos tipados:
     - *Onde parou (Summary)*
     - *O que falhou / Armadilhas (What Failed)*
     - *Dúvidas em aberto (Open Questions)*
     - *Próximos passos recomendados (Next Steps)*
   - Agentes receptores (ex.: Nero assumindo implementação da Quinta, ou Iris assumindo revisão) reivindicam o handoff e absorvem o contexto sem perda de histórico.

6. **Injeção de Contexto**:
   - Antes de planejar ou executar uma tarefa, o sistema consulta a memória para injetar regras ativas, decisões prévias e gotchas no contexto do prompt, evitando repetir erros passados.

---

## 2. Estrutura de Armazenamento e Disco

- **Diretório da Wiki**: `.waddle/memory/` na raiz do projeto (configurável via `WADDLE_MEMORY_DIR` com fallback para `%LOCALAPPDATA%/waddle/memory/`).
- **Formato dos Arquivos Markdown**:
  ```markdown
  ---
  id: dec-sqlite-fts5
  title: Uso do SQLite FTS5 para índice derivado de memória
  category: decisions
  agent: Quinta
  tags: [sqlite, storage, memory, fts5]
  created_at: 2026-09-09T17:30:00Z
  updated_at: 2026-09-09T17:30:00Z
  access_count: 5
  last_accessed_at: 2026-09-09T18:00:00Z
  retention: 1.0
  pinned: true
  ---

  # Contexto
  Necessidade de busca semântica e full-text local sem dependência de serviços externos pesados.

  # Decisão
  Adotar SQLite FTS5 com ranking BM25 integrado nativamente no Python.
  ```

---

## 3. Componentes Backend

### 3.1. Engine de Memória (`src/waddle/memory/engine.py`)
- Gerencia os arquivos no disco e a sincronização bidirecional com o SQLite.
- Parser e serializador de frontmatter YAML leve em Python puro (sem bibliotecas externas pesadas).
- Métodos centrais:
  - `store_page(category, title, content, agent, tags, pinned)`
  - `get_page(page_id)`
  - `update_page(page_id, data)`
  - `delete_page(page_id)`
  - `search_pages(query, category=None, limit=10)`
  - `sync_from_disk()`
  - `record_observation(kind, source, title, data)`
  - `consolidate_session(run_id, objective, tasks, status)`
  - `create_handoff(from_agent, to_agent, summary, what_failed, next_steps)`
  - `claim_handoff(handoff_id, agent_name)`
  - `get_pending_handoffs(agent_name=None)`

### 3.2. Extensão do Banco SQLite (`src/waddle/storage/database.py`)
- Tabelas:
  - `memory_pages`: Metadados, categorias, estatísticas de acesso e flags de fixação.
  - `memory_fts`: Tabela virtual FTS5 para busca textual ultra-rápida em títulos, tags e conteúdos.
  - `memory_observations`: Registro contínuo e sanitizado de eventos da equipe de agentes.
  - `memory_handoffs`: Registro de transferências de contexto entre agentes.

### 3.3. Observador de Ciclo de Vida e Injeção (`src/waddle/runtime/agent_runtime.py`)
- Inscrição no `EventBus` para captura contínua (`run.started`, `tool.executed`, `run.completed`, `run.failed`).
- Injeção automática das memórias mais relevantes (regras fixadas e gotchas) no prompt de planejamento do `ManagerAgent` e no contexto dos `WorkerAgents`.

### 3.4. Ferramentas Autônomas para os Agentes (`src/waddle/tools/memory.py`)
- `memory_store`: Permite ao agente registrar novos aprendizados ou decisões.
- `memory_search`: Permite ao agente pesquisar na base de conhecimento.
- `memory_recall`: Permite ao agente ler uma nota na íntegra.
- `memory_handoff`: Permite ao agente formalizar a passagem de bastão para um colega.

### 3.5. Endpoints REST (`src/waddle/api/server.py`)
- `GET /api/memory/stats`: Estatísticas gerais da base de memória.
- `GET /api/memory/pages`: Listagem e busca com filtros.
- `GET /api/memory/pages/{page_id}`: Obtenção de página individual.
- `POST /api/memory/pages`: Criação de nota na Wiki.
- `PUT /api/memory/pages/{page_id}`: Atualização de nota.
- `DELETE /api/memory/pages/{page_id}`: Exclusão de nota.
- `POST /api/memory/pages/{page_id}/pin`: Alternar fixação prioritária.
- `GET /api/memory/handoffs`: Listagem de handoffs.
- `POST /api/memory/handoffs`: Criação de handoff.
- `POST /api/memory/handoffs/{handoff_id}/claim`: Reivindicação de handoff.
- `GET /api/memory/timeline`: Log cronológico de eventos e observações.
- `POST /api/memory/sync`: Sincronização e reindexação dos arquivos `.md` do disco.

---

## 4. Componentes Frontend (React + TypeScript)

### 4.1. Tipos e Serviços de API
- Novos tipos em `web/src/types.ts`: `MemoryPage`, `MemoryHandoff`, `MemoryObservation`, `MemoryStats`.
- Funções em `web/src/services/api.ts` para consumo de todos os novos endpoints.

### 4.2. MemoryDrawer (`web/src/components/MemoryDrawer.tsx` & `.css`)
- Painel lateral deslizante com navegação por abas:
  1. **Wiki do Conhecimento**:
     - Chips de categorias (`_rules`, `decisions`, `gotchas`, `concepts`, `procedures`, `sessions`).
     - Barra de pesquisa integrada com FTS5.
     - Botão "+ Nova Memória" com formulário interativo.
     - Visualizador Markdown rico com destaque para código e tags.
     - Ações de fixação (Pin), edição e exclusão.
  2. **Handoffs entre Agentes**:
     - Cards visuais indicando "Origem ➔ Destino" e status.
     - Seções expansíveis para "O que foi feito", "Armadilhas encontradas" e "Próximos passos".
     - Ação de "Assumir Handoff".
  3. **Linha do Tempo (Log)**:
     - Feed de observações silenciosas e histórico do `log.md`.
  4. **Disco e Sincronização**:
     - Exibição do diretório físico da Wiki.
     - Botão para reindexação instantânea do disco para o SQLite.

### 4.3. Integração na Interface Geral
- Botão "🧠 Memória IA" adicionado em `AgentSidebar.tsx` e `Header.tsx`.
- Badge contextual no `ConversationView.tsx` informando quando regras e gotchas da memória foram injetados na resposta do agente.

---

## 5. Plano de Validação e Testes

1. **Testes Automatizados de Backend (`pytest`)**:
   - `tests/test_memory_engine.py`: Criação e leitura de arquivos `.md`, parsing de frontmatter e integridade no disco.
   - `tests/test_memory_database.py`: Indexação SQLite, testes de busca virtual FTS5 e ordenação com reforço de acessos.
   - `tests/test_memory_handoffs.py`: Criação, consulta e reivindicação de handoffs.
   - `tests/test_memory_tools.py`: Execução das ferramentas pelo `ToolRegistry`.
2. **Build do Frontend (`npm run build`)**:
   - Validação de tipos TypeScript e compilação sem warnings/erros.
3. **Validação Manual Integrada**:
   - Adição de regra na interface, conferência da criação física do arquivo `.md` no disco e verificação de sua influência nas respostas dos agentes.
