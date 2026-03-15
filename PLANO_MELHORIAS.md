# Plano de Melhorias - Waddle

## Objetivo

Transformar o projeto em um app desktop nativo, leve e confiavel para operar CLIs como `codex` e `qwen`, com um fluxo direto:

1. abrir o app
2. escolher o CLI
3. conectar
4. enviar prompt
5. acompanhar a resposta no chat

## Diagnostico Atual

- A base nativa em `PySide6 + QML` ja existe e abre no sistema.
- A UI ainda mistura prototipo visual com comportamento incompleto.
- A integracao com os CLIs precisa tratar melhor estados, erros e reconexao.
- O projeto agora esta consolidado na versao nativa, mas ainda precisa de limpeza e padronizacao em volta dessa base.
- Falta um caminho mais claro para build, instalacao e publicacao.

## Sprint 1 - Fluxo funcional da interface

### Meta

Fazer o app funcionar de ponta a ponta sem depender do terminal depois da abertura.

### Checklist

- [ ] Corrigir todos os cliques principais em `src/cli_harness/qml/Main.qml`
- [ ] Validar `Conectar`, `Reconectar`, `Parar sessao`, `Enviar`, `/model` e `/reset`
- [ ] Exibir estados claros: `idle`, `starting`, `ready`, `error`
- [ ] Mostrar erros do backend de forma legivel no chat
- [ ] Fazer autoscroll do chat durante streaming
- [ ] Garantir foco automatico no campo de prompt ao abrir o app
- [ ] Evitar estados mortos depois que o processo do CLI fecha

### Arquivos principais

- `src/cli_harness/qml/Main.qml`
- `src/cli_harness/native_controller.py`
- `src/cli_harness/backend_commands.py`

## Sprint 2 - UX e identidade visual

### Meta

Dar ao app uma identidade visual coerente, mais premium e menos improvisada.

### Checklist

- [x] Definir uma paleta unica e remover cores inconsistentes
- [x] Melhorar header, estado vazio, chat e composer
- [x] Ajustar tipografia para um visual mais proximo de apps Apple-like
- [x] Reduzir elementos decorativos sem funcao
- [x] Refinar espacos, raios, sombras e contraste
- [x] Diferenciar visualmente mensagens do usuario, agente e sistema
- [x] Melhorar o estado vazio com onboarding curto e util

## Sprint 3 - Integracao robusta com Codex e Qwen

### Meta

Tratar `codex` e `qwen` como sessoes persistentes estaveis.

### Checklist

- [ ] Melhorar sanitizacao de saida ANSI
- [ ] Separar resposta util do agente de logs do terminal
- [ ] Detectar encerramento inesperado e sugerir reconexao
- [ ] Padronizar inicializacao por backend
- [ ] Salvar configuracoes simples, como ultimo backend usado
- [ ] Permitir troca de backend sem reiniciar o app

### Arquivos principais

- `src/cli_harness/native_controller.py`
- `src/cli_harness/repl.py`
- `src/cli_harness/history.py`
- `src/cli_harness/backend_commands.py`

## Sprint 4 - Produto desktop

### Meta

Fechar o app como produto instalado no Linux.

### Checklist

- [ ] Consolidar instalacao com launcher, atalho e icone
- [ ] Adicionar script de build para distribuicao
- [ ] Definir nome final, metadata e identidade do app
- [ ] Organizar logs em pasta local previsivel
- [ ] Criar tela simples de preferencias
- [ ] Diagnosticar rapidamente quando `codex` ou `qwen` nao estiverem no `PATH`

### Arquivos principais

- `scripts/install_native_app.sh`
- `scripts/uninstall_native_app.sh`
- `pyproject.toml`
- `assets/osaurus-native.svg`

## Sprint 5 - Limpeza tecnica

### Meta

Reduzir manutencao desnecessaria e deixar a base mais clara.

### Checklist

- [x] Remover o legado `desktop/` e manter apenas a versao nativa
- [ ] Revisar imports, codigo morto e duplicacoes
- [ ] Centralizar configuracoes do app
- [ ] Atualizar `README.md` com o fluxo nativo real
- [ ] Padronizar nomes entre "Osaurus", "Osaurus Native" e "CLI AI Harness"

## Sprint 6 - Testes e confiabilidade

### Meta

Parar de depender apenas de validacao manual.

### Checklist

- [ ] Criar testes unitarios para `sanitize_terminal_text`
- [ ] Criar testes para mudanca de estado no controller
- [ ] Criar smoke test do app nativo
- [ ] Validar scripts de instalacao e publicacao
- [ ] Adicionar CI minima para build e testes

## Ordem Recomendada

1. Sprint 1 - fluxo funcional
2. Sprint 2 - UX e identidade visual
3. Sprint 3 - integracao robusta
4. Sprint 4 - produto desktop
5. Sprint 5 - limpeza tecnica
6. Sprint 6 - testes e CI

## Definicao de Pronto

O projeto estara em boa forma quando:

- o app abrir pelo atalho e pelo comando local
- `codex` e `qwen` conectarem sem comportamento imprevisivel
- o usuario conseguir conversar do inicio ao fim sem usar terminal
- a interface parecer consistente e intencional
- erros serem visiveis e recuperaveis
- exista um caminho simples para publicar novas versoes
