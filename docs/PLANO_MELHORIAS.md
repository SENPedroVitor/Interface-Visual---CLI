# Plano de Melhorias - Waddle

## Objetivo

Transformar o Waddle em um app desktop nativo, leve e confiável para operar CLIs como `codex` e `qwen`, com um fluxo direto:

1. abrir o app
2. escolher o CLI
3. conectar
4. enviar prompt
5. acompanhar a resposta no chat

---

## Diagnóstico Atual (revisado)

### O que está funcionando bem

- Arquitetura `PySide6 + QML` sólida: `native_controller.py` gerencia processo via PTY com `QSocketNotifier`, `MessageListModel` alimenta a view QML.
- Máquina de estados (`idle → starting → ready → error`) correta e wired na UI.
- `install_native_app.sh` completo: launcher, `.desktop`, ícones em múltiplas resoluções.
- `HistoryStore` salva sessões e eventos em SQLite seguindo XDG.
- `config.py` lê e escreve `.env` de forma centralizada.
- UI com paleta coerente (roxo/dark), componentes padronizados (`CapsuleButton`, `StatusBadge`, `StarterCard`, `IconBadge`).
- Estado vazio com mascote, saudação contextual por período do dia e starter cards.
- Diferenciação visual entre mensagens `user`, `ai` e `system`.
- Auto-scroll, auto-focus no campo de prompt.
- Botões Conectar, Reconectar, Parar, Enviar, `/model`, `/reset` todos funcionais.

### Bugs críticos encontrados

~~**1. Paths hardcoded para o usuário do desenvolvedor** (`native_controller.py` ~L387):~~
~~Os caminhos `/home/faux/.npm-global/bin` e `/home/faux/.nvm/versions/node/...` estão hardcoded,~~
~~quebrando o app em qualquer outra máquina.~~ ✅ **CORRIGIDO**

~~**2. Import duplicado dentro de função** (`connectBackend`):~~
~~`import subprocess as sp` é feito dentro da função, mas `subprocess` já está importado no topo do arquivo.~~ ✅ **CORRIGIDO**

### O que ainda está incompleto

| Sprint | Item | Status |
|--------|------|--------|
| Sprint 1 | Detectar quando CLI está realmente pronto (não marcar `ready` imediatamente) | ❌ |
| Sprint 1 | Botão "Reconectar" em destaque quando status = error | ✅ |
| Sprint 1 | Salvar e restaurar último backend usado | ✅ |
| Sprint 1 | `canSend` desabilitar no estado `error` | ✅ |
| Sprint 2 | Tabs `Work` e `Sandbox` desabilitadas permanentemente | ❌ |
| Sprint 2 | Background pixel art não responde ao resize | ❌ |
| Sprint 3 | Filtro de noise do Qwen praticamente desligado | ✅ |
| Sprint 3 | Debounce nos writes do histórico SQLite | ✅ |
| Sprint 4 | Tela de preferências (vault, comandos, nome) | ❌ |
| Sprint 4 | Script de build/distribuição | ❌ |
| Sprint 5 | Código legado ainda presente (bridge.py, repl.py, backends/, cli.py) | ✅ |
| Sprint 5 | README ainda foca no CLI antigo | ✅ |
| Sprint 6 | Zero testes, zero CI | ❌ |

### Novos problemas identificados (não mapeados antes)

- Sem renderização de Markdown no chat (código aparece como texto puro)
- `log_event` chamado a cada 4 KB lido do PTY — dezenas de commits SQLite por resposta
- `connectBackend` marca `ready` antes do CLI estar de fato pronto para input
- Tabs `Work` e `Sandbox` desabilitadas criam expectativa falsa
- Background pixel art com posições fixas, não responsivo
- Fontes genéricas (`"Sans Serif"`, `"Monospace"`) sem fallback para fontes melhores disponíveis no sistema

---

## ✅ Hotfix Imediato — CONCLUÍDO

~~**Corrigir paths hardcoded e import duplicado em `native_controller.py`.**~~

- ✅ Substituir lista `base_paths` hardcoded por construção dinâmica com `Path.home()` + detecção automática da versão NVM mais recente
- ✅ Remover `import subprocess as sp` de dentro da função (já importado no topo)

**Arquivo:** `src/cli_harness/native_controller.py`

---

## Sprint 1 — Polimento do fluxo funcional

### Meta

Fechar os últimos gaps do fluxo de ponta a ponta.

### Checklist

- [x] Conectar, Reconectar, Parar, Enviar, `/model`, `/reset` funcionais
- [x] Status display no header com `StatusBadge`
- [x] Encerramento de processo detectado via `_poll_timer` + `_handle_backend_exit`
- [x] Auto-scroll e auto-focus
- [x] Corrigir paths hardcoded (hotfix)
- [ ] Detectar prompt de inicialização do CLI para marcar `ready` só quando o agente estiver realmente pronto
- [x] Mostrar botão "Reconectar" em destaque na UI quando status = `error` (prop `needsReconnect` + `primary: true`)
- [x] Salvar último backend usado no `.env` (`WADDLE_LAST_BACKEND`) e restaurar na próxima abertura
- [x] `canSend` retornar `False` em estado `error` (não auto-reconectar silenciosamente)

### Arquivos principais

- `src/cli_harness/native_controller.py`
- `src/cli_harness/qml/Main.qml`
- `src/cli_harness/config.py`

---

## Sprint 2 — UX e identidade visual

### Meta

Dar ao app uma identidade visual coerente, mais premium e menos improvisada.

### Checklist

- [x] Paleta única e coerente (roxo/dark)
- [x] Header, estado vazio, chat e composer bem estruturados
- [x] Tipografia padronizada
- [x] Diferenciação visual de mensagens (user, ai, system)
- [x] Estado vazio com mascote, saudação e starter cards
- [ ] Remover ou requalificar tabs `Work` e `Sandbox` (mostrar tooltip "Em breve" ou remover)
- [ ] Tornar o background responsivo ao tamanho da janela (usar `window.width / window.height`)
- [ ] Tentar carregar fontes melhores (Inter, JetBrains Mono) com fallback para as genéricas

### Arquivos principais

- `src/cli_harness/qml/Main.qml`

---

## Sprint 3 — Integração robusta com Codex e Qwen

### Meta

Tratar `codex` e `qwen` como sessões persistentes estáveis com output limpo.

### Checklist

- [x] Sanitização ANSI funcional (`sanitize_terminal_text`)
- [x] Filtro de noise para Codex (`is_ui_noise_line`, `INTERNAL_TRACE_PREFIXES`)
- [x] Detecção de encerramento de processo
- [x] Melhorar filtro de output do Qwen: `_clean_qwen_line` com `QWEN_TUI_NOISE_RE`, `QWEN_CHROME_RE` e todos os filtros de noise aplicados
- [ ] Detectar encerramento inesperado com código != 0 e mostrar mensagem orientativa específica
- [x] Salvar e restaurar último backend usado (feito no Sprint 1)
- [x] Debounce nos writes de histórico: `_history_buffer` + `_history_flush_timer` (flush a cada 2.5s)

### Arquivos principais

- `src/cli_harness/native_controller.py`
- `src/cli_harness/history.py`

---

## Sprint 4 — Produto desktop

### Meta

Fechar o app como produto instalado e configurável sem tocar no terminal.

### Checklist

- [x] Script de instalação com launcher, desktop entry e ícones
- [x] Diagnóstico de PATH quando `codex`/`qwen` não encontrados (mensagem de erro no chat)
- [ ] **Tela de preferências simples** (sheet/drawer no QML) com campos para:
  - Caminho do vault (`OBSIDIAN_VAULT_PATH`)
  - Comando do Codex (`CODEX_CMD`) e Qwen (`QWEN_CMD`)
  - Nome de exibição (`OSAURUS_NAME`)
- [ ] Diagnóstico amigável na UI quando CLI não está no PATH: painel orientativo com instrução de instalação, em vez de só mensagem de erro no chat
- [ ] Script `scripts/build_snapshot.sh` para gerar tarball distribuível
- [ ] Versão do app (`pyproject.toml`) visível no header ou tela de preferências

### Arquivos principais

- `src/cli_harness/qml/Main.qml`
- `src/cli_harness/config.py`
- `src/cli_harness/native_controller.py`
- `scripts/install_native_app.sh`
- `pyproject.toml`

---

## Sprint 5 — Limpeza técnica

### Meta

Remover legado e deixar a base mais clara antes de adicionar novas features.

### Checklist

- [x] Legado `desktop/` removido
- [x] **Arquivar/remover código legado:**
  - ~~`src/cli_harness/bridge.py`~~ — removido ✅
  - ~~`src/cli_harness/repl.py`~~ — removido ✅
  - ~~`src/cli_harness/backends/`~~ — removido ✅
  - ~~`src/cli_harness/cli.py`~~ — removido ✅
  - `src/cli_harness/history_cli.py` — mantido (útil para debug de sessões)
- [x] Reescrever `README.md` focando no fluxo nativo (install → abrir → usar)
- [x] Remover import duplicado `subprocess as sp` de dentro de `connectBackend`
- [ ] Centralizar strings de UI (labels, erros, saudações) em módulo `strings.py`
- [ ] Padronizar nome: "Waddle" em todos os lugares (remover referências a "Osaurus Native" e "CLI AI Harness")

### Arquivos principais

- `src/cli_harness/bridge.py` (remover)
- `src/cli_harness/repl.py` (remover)
- `src/cli_harness/backends/` (remover)
- `src/cli_harness/cli.py` (remover)
- `src/cli_harness/history_cli.py` (remover ou integrar)
- `src/cli_harness/native_controller.py`
- `README.md`

---

## Sprint 6 — Renderização rica no chat

### Meta

Respostas de código ficarem legíveis diretamente na UI, sem precisar copiar para um editor.

### Checklist

- [ ] Implementar renderização básica de Markdown nos balões do AI:
  - Detectar blocos de código (` ``` `) e renderizar com fundo monoespaçado e borda
  - Negrito (`**texto**`) e itálico
  - Listas com marcadores
  - (Converter markdown → HTML no Python antes de enviar ao QML via `TextEdit` com `textFormat: TextEdit.RichText`)
- [ ] Botão "Copiar" em cada bloco de código
- [ ] Botão "Copiar tudo" no balão do AI

### Arquivos principais

- `src/cli_harness/native_controller.py`
- `src/cli_harness/qml/Main.qml`

---

## Sprint 7 — Testes e confiabilidade

### Meta

Parar de depender apenas de validação manual.

### Checklist

- [ ] Testes unitários para `sanitize_terminal_text` e `is_ui_noise_line`
- [ ] Testes para `normalize_prompt_text` e `_looks_like_prompt_echo`
- [ ] Testes para a máquina de estados do controller (idle → starting → ready → error → idle)
- [ ] Testes para `HistoryStore` (open, start_session, log_event, end_session)
- [ ] Smoke test do app nativo (janela abre, controller instancia, QML carrega sem erros)
- [ ] Validar scripts de instalação e desinstalação
- [ ] GitHub Actions: rodar testes + lint (ruff) no push

### Arquivos principais

- `tests/` (criar)
- `.github/workflows/ci.yml` (criar)

---

## Ordem Recomendada de Execução

```
Hotfix → Sprint 1 → Sprint 3 → Sprint 5 → Sprint 4 → Sprint 2 → Sprint 6 → Sprint 7
```

**Justificativa:**
1. **Hotfix** — bug que quebra em qualquer máquina além da de desenvolvimento, prioridade máxima
2. **Sprint 1** — fecha o fluxo funcional com os últimos gaps
3. **Sprint 3** — melhora qualidade do output (afeta a experiência em toda conversa)
4. **Sprint 5** — limpa o código antes de adicionar mais features
5. **Sprint 4** — tela de preferências (com base limpa)
6. **Sprint 2** — ajustes visuais finais
7. **Sprint 6** — renderização Markdown (feature nova, alto impacto visual)
8. **Sprint 7** — testes (idealmente ao longo de tudo, mas CI estruturado no final)

---

## Definição de Pronto

O projeto estará em boa forma quando:

- o app abrir pelo atalho e pelo comando local em qualquer máquina Linux
- `codex` e `qwen` conectarem sem comportamento imprevisível
- o usuário conseguir conversar do início ao fim sem usar o terminal
- a interface parecer consistente e intencional
- erros forem visíveis, orientativos e recuperáveis
- código nas respostas do AI for renderizado e copiável
- existir um caminho simples para publicar novas versões
- testes unitários cobrindo as funções críticas de parsing e estado

---

**Última atualização:** 2025-07-14