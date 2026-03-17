# Plano de Sprints - Aba de Chat (Waddle)

## Escopo

Melhorias da aba de chat nativa (`PySide6 + QML`) para confiabilidade, UX e manutenção.

## Sprint 1 - Estabilidade e UX Base

### Objetivo

Deixar o fluxo principal robusto e reduzir risco de quebra visual.

### Entregas

- Componentização da aba de chat (`ChatHeader`, `ChatMessageList`, `MessageBubble`, `ChatComposer`)
- Auto-scroll inteligente (não forçar scroll quando usuário está lendo histórico)
- Cópia de mensagem em texto limpo (sem HTML bruto)
- Estado visual do composer (`connecting`, `ready`, `sending`, `error`)

### Status

- Concluída

## Sprint 2 - Sessão/CLI Resiliente

### Objetivo

Tornar conexão e execução do backend mais previsíveis e acionáveis em falhas.

### Entregas

- Estado de sessão explícito no controller (`idle`, `starting`, `ready`, `streaming`, `error`)
- Retry automático controlado na conexão (1 retry)
- Timeout de resposta configurável em Preferences
- Mensagens de erro mais orientativas (ação clara para recuperar)

### Status

- Concluída

## Sprint 3 - Performance e Persistência

### Objetivo

Melhorar fluidez da conversa e reduzir custo de I/O em sessões longas.

### Entregas planejadas

- Debounce de render durante streaming (janela de atualização de chunks)
- Escrita em lote/transação para histórico SQLite
- Tratamento de mensagens muito longas (colapsar/expandir)

### Critérios de aceite

- Sem travamentos perceptíveis em respostas longas
- Redução de commits SQLite por resposta
- UI responsiva com grande volume de texto

### Status

- Planejada

## Sprint 4 - Funcionalidades de Conversa

### Objetivo

Evoluir a aba de chat para uso contínuo com histórico navegável.

### Entregas planejadas

- Sidebar de sessões (listar/restaurar)
- Ações de conversa: novo chat, renomear, limpar
- Busca dentro da conversa
- Exportação para Markdown

### Critérios de aceite

- Usuário recupera sessões antigas sem terminal
- Fluxo de organização de conversas completo na UI

### Status

- Planejada

## Sprint 5 - Segurança e Privacidade

### Objetivo

Reduzir risco de exposição de dados sensíveis no histórico.

### Entregas planejadas

- Opção para desativar persistência de histórico
- Redação/mascaramento de padrões sensíveis antes de salvar
- Mensagens de diagnóstico mais seguras (sem vazar tokens/segredos)

### Critérios de aceite

- Dados sensíveis não persistem em texto cru
- Usuário controla política de retenção de histórico

### Status

- Planejada

## Sprint 6 - Qualidade Contínua

### Objetivo

Evitar regressões em parsing, estado de sessão e runtime QML.

### Entregas planejadas

- Testes unitários para máquina de estados e timeout
- Testes de integração offscreen para fluxo de chat
- Checklist de regressão da aba de chat

### Critérios de aceite

- Pipeline local de testes confiável
- Mudanças no chat não quebram boot/renderização

### Status

- Em progresso
