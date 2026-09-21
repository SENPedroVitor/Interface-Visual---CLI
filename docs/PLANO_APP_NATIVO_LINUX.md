# Plano de execução: Waddle nativo para Linux

Status: em execução. O inventário de paridade inicial foi criado em `docs/paridade-interface.md`, e a primeira fatia funcional do núcleo Linux nativo em `src/waddle_desktop/` foi verificada com testes focados. A QML nova carrega offscreen com PySide6 e chama o runtime Python diretamente, mas a paridade completa, credenciais Linux protegidas, provedores configuráveis e empacotamento `.deb` seguem pendentes.

## Objetivo e critérios de produto

Entregar um aplicativo instalável para Linux com interface implementada em Qt/QML. A interface web atual é a referência obrigatória de aparência e comportamento. O aplicativo instalado não deve abrir navegador, usar WebView, executar React/Vite nem exigir Node.js. O núcleo Python, os agentes e o banco SQLite podem ser compartilhados pelas duas interfaces.

O primeiro alvo de distribuição será um pacote `.deb` para Ubuntu LTS; a versão exata e as arquiteturas suportadas serão fixadas antes do empacotamento. Outros formatos só entram após a validação desse pacote.

## Contrato de paridade

Antes de implementar cada tela, registrar captura da versão web, estados visuais (vazio, carregando, erro e conteúdo), interações, navegação, atalhos e comportamento em tamanhos de janela diferentes. A tela QML deve ser comparada lado a lado com essa referência. Diferenças aceitas precisam ser registradas com motivo e prazo de correção.

Criar uma matriz em `docs/paridade-interface.md` com uma linha por fluxo: onboarding; navegação e conversas; chat individual e em grupo; envio de arquivos; perfil do usuário; Agent Studio; modelos e provedores; tarefas e terminal; rotinas; histórico; configurações; estados dos mascotes; tema claro/escuro. Para cada linha, acompanhar `web documentada`, `QML implementada`, `fluxo testado` e `paridade aprovada`.

Para reduzir divergências futuras, manter tokens de cor, tipografia, espaçamento e assets em uma fonte de referência documentada, com equivalentes gerados ou verificados para CSS e QML. Uma mudança visual na web deve atualizar a matriz e a implementação QML na mesma entrega de produto.

## Arquitetura alvo

- `src/waddle/`: lógica de domínio, agentes, provedores, histórico, tarefas, rotinas e persistência compartilhados.
- `src/cli_harness/` ou novo módulo `src/waddle_desktop/`: processo Qt, modelos de dados para QML, navegação e integração com o sistema Linux. A decisão de renomear será tomada na primeira entrega, sem bloquear a migração.
- `web/`: interface web existente, mantida como produto e referência visual; não entra no pacote Linux nativo.
- API FastAPI: continua disponível para a versão web e integrações. O desktop deve chamar serviços Python compartilhados, sem depender de um servidor HTTP local para funcionar.
- Operações demoradas de agentes e CLIs devem rodar fora da thread de interface; sinais Qt atualizam estados, progresso e cancelamento.

## Entregas

### 0. Inventário e referência visual

Status: concluído para a primeira fatia; deve continuar sendo atualizado por fluxo. A matriz inicial registra evidências dos componentes React lidos e explicita pendências de QML, teste e aprovação visual.

Mapear componentes e fluxos de `web/src` para QML, capturar telas de referência e preencher a matriz de paridade. Identificar lógica hoje presa a componentes React ou endpoints e separar o que deve virar serviço compartilhado.

**Pronto quando:** cada fluxo da interface web tem referência, estado esperado e prioridade; existe uma lista explícita do que falta na QML atual.

### 1. Núcleo Linux funcional

Status: primeira fatia verificada. Existe uma entrada Qt/QML nativa separada (`waddle-desktop`) que lista/seleciona agentes, carrega histórico SQLite, envia uma mensagem ao `AgentRuntime` fora da thread da interface, mostra resposta/status e cancela a execução ativa. Os testes focados cobrem serviço, persistência, cancelamento e carregamento QML offscreen com `WADDLE_DATA_DIR` temporário. Ainda faltam credenciais Linux protegidas, configuração completa de provedores, migração XDG validada e persistência de todos os estados da experiência.

Extrair serviços compartilhados para conversas, agentes e configurações. Implementar armazenamento persistente de segredos integrado ao serviço de credenciais do desktop Linux, com erro claro quando indisponível. Ajustar descoberta de Ollama/Codex/Claude para caminhos Linux e `PATH`; retirar caminhos Windows fixos dos padrões usados no Linux. Definir diretórios de dados, cache e configuração conforme XDG e migração dos dados locais existentes.

**Pronto quando:** o app QML abre, conversa com o runtime real, salva e recupera histórico, configura um provedor e reinicia mantendo os dados. Nenhuma chave fica em texto puro.

### 2. Paridade da experiência principal

Recriar em QML, nesta ordem: estrutura da janela e navegação; conversas individuais e de grupo; composição e renderização de mensagens; anexos e visualização de arquivos; perfil e tema; mascotes e seus estados. Reaproveitar assets visuais existentes, adaptando animações para Qt.

**Pronto quando:** os fluxos principais da matriz passam em comparação visual e funcional lado a lado com a web.

### 3. Paridade das ferramentas e configurações

Recriar Agent Studio, provedores/modelos, tarefas e terminal, rotinas, histórico, estados de execução, parada e retomada. Usar os mesmos serviços e dados da versão web; evitar regras de negócio duplicadas em QML.

**Pronto quando:** todas as linhas obrigatórias da matriz estão implementadas e testadas. Diferenças restantes estão documentadas e aprovadas como específicas do desktop.

### 4. Pacote instalável e validação

Empacotar interpretador Python, dependências, módulos Qt/QML e assets; criar ícone, entrada `.desktop`, metadados, instalador e remoção. O pacote deve instalar fora do checkout do Git. Validar em instalação limpa da distribuição alvo e testar atualização preservando SQLite e credenciais.

**Pronto quando:** instalar o `.deb`, abrir pelo menu, completar onboarding, conversar, executar/parar uma tarefa, reiniciar e recuperar dados, atualizar e desinstalar funcionam sem Node.js, navegador ou ambiente virtual preparado pelo usuário.

## Verificações por entrega

1. Testes Python dos serviços compartilhados e das diferenças Windows/Linux.
2. Testes de integração entre modelos Qt e runtime, incluindo cancelamento e encerramento de processos.
3. Capturas comparativas de QML e web nos mesmos tamanhos e estados de interface.
4. Teste manual do pacote em sistema limpo, incluindo Wayland e X11 se ambos fizerem parte do alvo suportado.

## Dependências e riscos conhecidos

- A QML atual cobre principalmente o chat com CLIs; não é equivalente à interface React. A migração é uma reconstrução de interface, não uma troca de launcher.
- `src/waddle/security/credentials.py` usa DPAPI no Windows e deixa o armazenamento persistente indisponível no Linux.
- `src/waddle/providers.py` contém caminhos e mensagens específicos do Windows.
- `scripts/install_native_app.sh` instala um atalho dependente do checkout e do `.venv`; ainda não produz um pacote distribuível.
- Algumas definições de agente usam caminhos absolutos Windows e precisam virar configuração por instalação ou por usuário.
- Duas interfaces exigem disciplina de paridade contínua; a matriz e as capturas fazem parte do processo de entrega.

## Sequência de trabalho

Executar 0 e 1 antes de expandir telas. Entregar 2 e 3 em fluxos verticais completos, cada um com dados reais e comparação visual. Iniciar o empacotamento durante 2 para detectar cedo problemas de distribuição; concluir 4 somente após a paridade obrigatória.
