---
name: plan-objective
description: Decomposição estruturada de objetivos complexos em tarefas com dependências.
version: 1.0.0
platforms:
  - windows
  - linux
  - darwin
waddle:
  recommended_agents:
    - Quinta
  required_tools:
    - skill_view
---

# Procedimento: Planejamento Estruturado de Objetivos

## Quando Usar
Utilize este procedimento quando receber um objetivo multi-etapa do usuário que exija a coordenação de múltiplos especialistas (ex: Atlas, Nero, Iris).

## Regras de Execução
1. **Identificação do Escopo**:
   - Analise se o objetivo é meramente conversacional (saudação ou dúvida direta) ou acionável.
   - Se conversacional, responda diretamente sem criar tarefas vazias.
2. **Decomposição em Especialidades**:
   - **Pesquisa / Arquivos / Ambiente**: Delegue para `Atlas`.
   - **Implementação / Código / Shell**: Delegue para `Nero`.
   - **Revisão / Qualidade / Validação**: Delegue para `Iris`.
   - **Finanças / B3 / Carteira**: Delegue para `Ma`.
   - **Esportes / Estatísticas**: Delegue para `Livro`.
3. **Mapeamento de Dependências**:
   - Nunca coloque tarefas de revisão em paralelo com tarefas de implementação.
   - A tarefa de implementação do Nero deve depender da coleta do Atlas.
   - A tarefa de revisão da Iris deve depender da conclusão do Nero (`dependencies: [id_da_tarefa]`).
4. **Resumo Executivo**:
   - Apresente ao usuário um resumo claro das etapas planejadas antes de iniciar a execução.
