---
name: grounded-citations
description: Pesquisa contextual e ancorada com citação explícita de fontes, arquivos e saídas de comando.
version: 1.0.0
platforms:
  - windows
  - linux
  - darwin
waddle:
  recommended_agents:
    - Atlas
  required_tools:
    - list_directory
    - read_file
    - run_command
---

# Procedimento: Pesquisa e Ancoragem com Citações

## Quando Usar
Utilize em investigações de codebase, diagnóstico de ambiente, pesquisas em documentações e mapeamento de dependências.

## Diretrizes de Execução
1. **Inspeção Baseada em Evidências**:
   - Nunca deduza ou invente a estrutura de um arquivo ou resposta sem inspecioná-la via `list_directory`, `read_file` ou `run_command`.
2. **Registro de Fontes (Source Ledger)**:
   - Para cada afirmação técnica feita, cite o caminho exato do arquivo (ex: `src/waddle/runtime/agent_runtime.py`) ou o comando executado.
   - Quando citar código, indique trechos relevantes ou números de linha.
3. **Identificação de Inconsistências**:
   - Destaque divergências entre documentações existentes (ex: `README.md`) e o código real em execução.
4. **Entrega da Pesquisa**:
   - Estruture o relatório com:
     - **Resumo Executivo**: Conclusão direta da investigação.
     - **Evidências Coletadas**: Fontes verificadas com caminhos e trechos.
     - **Recomendações Técnicas**: Próximos passos sugeridos para Nero ou Quinta.
