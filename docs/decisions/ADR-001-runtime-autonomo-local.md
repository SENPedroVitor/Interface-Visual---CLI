# ADR-001: Runtime autônomo local supervisionado

## Status

Aceito

## Data

2026-09-13

## Contexto

O Waddle já possui agentes, ferramentas, SQLite e uma interface React, mas o
launcher dependia de esperas fixas e as rotinas salvas só executavam quando o
usuário acionava a API manualmente. Isso fazia o produto parecer automático
sem manter um ciclo de execução confiável.

## Decisão

Manter o runtime local em um único processo FastAPI, com um scheduler assíncrono
iniciado no `lifespan` e um launcher supervisor para API, frontend e Ollama.

- Rotinas `active` são avaliadas periodicamente e registram `running`,
  `completed` ou `failed` em SQLite.
- O launcher aguarda `/health`, inicia o frontend somente após readiness e
  encerra a árvore de processos em conjunto.
- Ollama é iniciado apenas quando encontrado e ainda indisponível; Codex e
  Claude continuam opcionais e nunca exigem chave para o fallback local.
- O kill switch permanece o limite explícito para interromper execuções.

## Alternativas consideradas

### Serviço externo ou Docker Compose

Rejeitado nesta fase: adicionaria instalação e operação extra para um projeto
que precisa funcionar offline em uma máquina Windows comum.

### Scheduler de terceiros

Rejeitado por enquanto: os formatos iniciais (`todo dia às HH:MM` e `a cada N
minutos`) cabem em um loop pequeno, sem nova dependência ou migração.

### Execução distribuída por agente

Adiada: os agentes já se comunicam por EventBus e SQLite. Processos separados,
fila durável e retomada de jobs serão uma etapa posterior do roadmap.

## Consequências

- O sistema pode continuar útil sem Ollama, Codex ou Claude configurados.
- O processo do backend continua sendo o ponto único de falha; o supervisor
  reduz quedas acidentais, mas não substitui uma fila persistente.
- O scheduler usa o fuso horário do relógio fornecido pelo runtime; a próxima
  evolução deve tornar o fuso da rotina explícito para instalações distribuídas.
- A inicialização no Windows é opt-in: `scripts/install_autostart.ps1` cria uma
  tarefa por usuário no logon, com modo de sessão `Interactive` (o enum
  equivalente ao antigo `InteractiveToken`), nível `Limited`,
  `StartWhenAvailable` e `IgnoreNew`; `scripts/uninstall_autostart.ps1` a
  remove de forma reversível.
