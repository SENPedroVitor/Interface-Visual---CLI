# Plano de Melhorias — Waddle Interface

> Última atualização: 2026-09-11  
> Status geral: Em andamento

---

## 1. Botão `+` no Input de Mensagem

**Descrição:**  
Adicionar um botão `+` ao lado esquerdo do campo de input de mensagem. Ao clicar, um menu flutuante (popover) aparece com as seguintes opções:

- Calendário — abre o DatePicker para selecionar uma data/hora e inserir no chat  
- Enviar arquivo — abre o seletor de arquivo do sistema  
- Configurações do usuário — abre modal para personalizar perfil (nome, avatar)

**Arquivos afetados:**
- web/src/components/ConversationView.tsx  
- web/src/components/DatePicker.tsx  
- web/src/components/UserConfigModal.tsx (novo)

**Status:** [x] Concluído (Fase 1)

---

## 2. Componente Terminal Animado

**Descrição:**  
Quando a IA precisar mostrar um output de terminal, renderizar um componente estilo terminal macOS com animação de digitação linha a linha usando motion/react.

Comportamento:
- Fundo escuro, fonte mono  
- Linhas aparecem progressivamente (efeito typewriter com motion)  
- Highlight de erros (vermelho) e sucesso (verde)  
- Botão de copiar o conteúdo completo e botão de replay / pular animação

**Arquivos afetados:**
- web/src/components/TerminalOutput.tsx (novo)  
- web/src/components/TerminalOutput.css (novo)  
- web/src/components/MarkdownMessage.tsx (integração)

**Status:** [x] Concluído

---

## 3. Componente File Tree

**Descrição:**  
Quando a IA retornar uma estrutura de arquivos ou diretórios, renderizar um componente visual de árvore de arquivos (estilo VS Code), com ícones por tipo e expansão/colapso de pastas.

**Arquivos afetados:**
- web/src/components/FileTree.tsx (novo)  
- web/src/components/FileTree.css (novo)  
- web/src/components/MarkdownMessage.tsx (integração)

**Status:** [x] Concluído

---

## 4. Arquitetura de Group Chat (Inter-bots)

**Descrição:**  
Criar um espaço de grupo separado onde os bots se comunicam entre si. O chat do usuário com "Quinta" permanece privado. "Quinta" pode compartilhar resumos do grupo no chat com o usuário.

**Mudanças de arquitetura:**
- Novo tipo de conversa: group vs direct  
- ConversationView suporta renderização de grupo com identificação visual de cada bot (Quinta Líder, Atlas Pesquisa, Nero Execução, Iris Revisão)  
- Sidebar esquerda: canal fixo "Equipe Waddle (Inter-Bots)" no topo das equipes + suporte a múltiplos squads customizados

**Arquivos afetados:**
- web/src/components/ConversationView.tsx  
- web/src/components/AgentSidebar.tsx  
- web/src/App.tsx  
- web/src/index.css

**Status:** [x] Concluído

---

## 5. Configuração de Usuário (Perfil)

**Descrição:**  
O usuário deve poder configurar seu próprio perfil:
- Alterar nome de exibição  
- Upload de avatar personalizado ou escolha de ícone pré-definido  
- Avatar exibido nas mensagens do usuário no chat

**Arquivos afetados:**
- web/src/components/UserConfigModal.tsx (novo)  
- web/src/components/ConversationView.tsx  
- web/src/App.tsx (contexto de usuário global)

**Status:** [x] Concluído (Fase 1)

---

## 6. Melhorias no AgentStudioModal

**Descrição:**  
O modal de configuração e criação de bots tem vários problemas visuais e funcionais:

- Não acompanha o tema claro (cores hardcoded)  
- SVGs e ícones desatualizados — não usa os componentes do projeto (Icons.tsx)  
- Mudança de cor do avatar não reflete imediatamente no preview  
- Paleta de cores limitada e sem preview em tempo real  
- Abas do modal (identity, soul, skills, memory, model) sem transição/animação entre elas

**Arquivos afetados:**
- web/src/components/AgentStudioModal.tsx  
- web/src/components/AgentStudioModal.css  
- web/src/components/ModelSelectorDrawer.css  
- web/src/components/WaddleAvatar.tsx  
- web/src/utils/agentVisuals.ts

**Status:** [x] Concluído (Fase 1)

---

## 7. Mensagens do Usuário com Avatar e Perfil

**Descrição:**  
Atualmente, as mensagens do usuário no chat não têm avatar/identidade visual consistente. Após implementar o perfil de usuário (item 5), o avatar deve aparecer ao lado das mensagens do usuário, espelhando o comportamento dos bots.

**Arquivos afetados:**
- web/src/components/ConversationView.tsx  
- web/src/index.css

**Status:** [x] Concluído (Fase 1)

---

## 8. Melhorias no MarkdownMessage

**Descrição:**  
O componente atual (MarkdownMessage.tsx) recebeu:

- Suporte a tabelas markdown (| col | col |)  
- Suporte a blockquotes (> texto) com destaque e borda colorida  
- Suporte a headings dentro de mensagens (# h1, ## h2, ### h3)  
- Renderização integrada de Terminal Animado (MacOS style) e Árvore de Arquivos (FileTree)

**Arquivos afetados:**
- web/src/components/MarkdownMessage.tsx
- web/src/index.css

**Status:** [x] Concluído

---

## 9. Persistência de Configurações do Usuário

**Descrição:**  
Configurações da interface sincronizadas e persistidas:

- Preferências do usuário (nome, avatar, cor, foto) salvas no localStorage (`waddle-user-profile`)  
- Tema claro/escuro persistido no localStorage (`waddle-theme`)  
- Customizações dos bots (cor, nome, personalidade, cosméticos, memórias) persistidos no backend SQLite (`AgentRuntime`)

**Arquivos afetados:**
- web/src/App.tsx  
- web/src/components/UserConfigModal.tsx  
- src/waddle/storage/database.py

**Status:** [x] Concluído

---

## 10. Melhorias Visuais Gerais (Backlog)

| Item | Prioridade | Status |
|---|---|---|
| AgentStudioModal acompanhar tema claro/escuro | Alta | [x] Concluído |
| SVGs do modal de bot atualizar para ícones do projeto | Média | [x] Concluído |
| Mudança de cor do avatar refletir imediatamente | Alta | [x] Concluído |
| Terminal animado estilo MacOS no chat | Alta | [x] Concluído |
| Visualizador de File Tree estilo VS Code no chat | Média | [x] Concluído |
| Suporte a tabelas, blockquotes e títulos no MarkdownMessage | Média | [x] Concluído |
| Persistência de tema e configurações no localStorage/backend | Alta | [x] Concluído |
| Canal dedicado Equipe Waddle / Inter-bots | Alta | [x] Concluído |
| Transições animadas entre abas do AgentStudioModal | Baixa | [x] Concluído |
| Animação de carregamento / presença de escrita | Baixa | [x] Concluído |
| StatusTimeline estilo pipeline de etapas / CI/CD | Alta | [x] Concluído |

---

## Ordem de Implementação Sugerida

1. [x] AgentStudioModal — fix de tema e avatar (item 6) — Concluído  
2. [x] Botão + no input (item 1) — Concluído  
3. [x] Configuração de Usuário / Modal (item 5) — Concluído  
4. [x] Avatar do usuário nas mensagens (item 7) — Concluído  
5. [x] Terminal Animado MacOS (item 2) — Concluído  
6. [x] File Tree estilo VS Code (item 3) — Concluído  
7. [x] Melhorias no MarkdownMessage (item 8) — Concluído  
8. [x] Persistência de configurações (item 9) — Concluído  
9. [x] Group Chat / Arquitetura Inter-Bots (item 4) — Concluído  
10. [x] Refinamentos visuais (abas animadas) (item 10) — Concluído    
11. [x] StatusTimeline animado para pipelines e etapas (item 11) — Concluído

