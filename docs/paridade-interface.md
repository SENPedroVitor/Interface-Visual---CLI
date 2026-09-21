# Paridade da interface Waddle

Matriz inicial baseada em leitura de `web/src/App.tsx`, `web/src/components/AgentSidebar.tsx`, `web/src/components/ConversationView.tsx`, `web/src/index.css`, `web/src/components/DesignRefinements.css`, `src/cli_harness/qml/Main.qml` e `src/waddle/runtime/agent_runtime.py`.

Status usado: `sim`, `parcial`, `nao`, `pendente`.

| Fluxo | Evidencia web React | QML implementada | Fluxo testado | Paridade aprovada | Pendencias explicitas |
| --- | --- | --- | --- | --- | --- |
| Onboarding | `App.tsx` controla `OnboardingScreen` por `ONBOARDING_KEY`. | nao | nao | nao | Recriar tela e persistencia nativa, sem `localStorage`. |
| Navegacao e conversas | `AgentSidebar` lista busca, squads, agentes, rodape e selecao; `App.tsx` alterna agente/grupo. | parcial | parcial | nao | Nova QML lista agentes e seleciona conversa individual; busca, squads e menus ficam pendentes. |
| Chat individual e em grupo | `ConversationView` renderiza mensagens, atividades, grupos, composer, sugestoes e estados. | parcial | parcial | nao | Chat individual inicial funciona com runtime real; grupos, atividades ricas, markdown completo e sugestoes seguem pendentes. |
| Envio de arquivos | `ConversationView` usa `Dropzone`, anexos, arrastar/soltar e composicao com metadados. | nao | nao | nao | Implementar seletor nativo de arquivos e encaminhamento ao runtime compartilhado. |
| Perfil do usuario | `UserConfigModal`, `UserAvatar` e perfil em `localStorage`. | nao | nao | nao | Criar modelo nativo e persistencia compartilhada. |
| Agent Studio | `AgentStudioModal` cria/edita detalhes, alma, memoria, skills e visual. | nao | nao | nao | Expor CRUD completo de agentes em QML sobre `AgentRuntime`. |
| Modelos e provedores | `ProviderSettingsModal`, `fetchProviders`, estado de provedores e seletor. | nao | nao | nao | Configuracao Linux, discovery de Ollama/Codex/Claude e credenciais protegidas. |
| Tarefas e terminal | `DeveloperDrawer`, tarefas, ferramentas, eventos e terminal. | nao | nao | nao | Criar paineis QML e modelos de tarefas/ferramentas. |
| Rotinas | `RoutineDrawer`, `DatePicker`, rotina por agente e scheduler via API. | nao | nao | nao | Integrar `routine_scheduler` ao desktop sem HTTP local. |
| Historico | `fetchHistory` carrega mensagens, eventos, artefatos e rotinas do SQLite via API. | parcial | parcial | nao | Nova QML carrega mensagens SQLite por agente; eventos, runs, artefatos, rotinas e prompts do usuario persistidos ficam pendentes. |
| Configuracoes | Modais de usuario, provedores, plugins, tema e drawer de desenvolvedor. | nao | nao | nao | Planejar preferencias nativas e fonte comum de tokens. |
| Estados dos mascotes | `WaddleAvatar`, `agentStateFromStatus`, estados de presenca e animacoes. | parcial | nao | nao | QML inicial usa avatares circulares por cor; mascotes/animacoes reais precisam ser portados. |
| Tema claro/escuro | `index.css` define tokens, modo escuro por sistema e toggle explicito. | parcial | nao | nao | QML inicial aplica tokens escuros principais; modo claro e toggle ficam pendentes. |

## Mapeamento React -> QML da primeira fatia

| React | QML/Python nativo | Status |
| --- | --- | --- |
| `AgentSidebar` lista agentes de `agents` | `waddle_desktop.qml.Main` + `AgentListModel`, alimentado por `DesktopRuntimeService.list_agents()` | parcial |
| `selectedAgentId` / `onSelectAgent` | `DesktopController.selectedAgentName` e `selectAgent(name)` | parcial |
| `fetchHistory()` / `/api/history` | `DesktopRuntimeService.list_history()` lendo `runtime.database.list_messages()` diretamente | parcial |
| `submitObjective()` / `/api/objectives` | `DesktopRuntimeService.submit_prompt()` chama `AgentRuntime.run_objective()` em thread propria, sem localhost HTTP | parcial |
| WebSocket `agent.message` | Assinatura direta ao `EventBus`; eventos viram mensagens no `MessageListModel` | parcial |
| `triggerKillSwitch()` | `DesktopRuntimeService.cancel_active()` cancela a task asyncio ativa; `shutdown()` cancela antes de sair | parcial |
| `ConversationView` composer | `TextArea` QML com Enter para enviar e botao de envio | parcial |
| Design tokens CSS | Propriedades QML espelhando `--bg-*`, `--text-*`, `--border`, `--accent`, raios e espacamento principais | parcial |

## Pendencias para nao confundir esta fatia com paridade completa

- Esta entrega nao substitui a interface web nem empacota `.deb`.
- A QML nova nao usa React, WebView, Vite, navegador ou servidor HTTP local.
- Prompts do usuario ainda aparecem na sessao ativa, mas a persistencia historica reutilizada pelo runtime armazena mensagens dos agentes.
- Credenciais Linux protegidas, provedores/modelos editaveis, squads, anexos, Agent Studio, terminal, rotinas, perfil, onboarding e comparacao visual por captura seguem pendentes.
