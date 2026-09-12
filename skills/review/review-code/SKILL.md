---
name: review-code
description: Revisão criteriosa de código, arquitetura, cobertura de testes e riscos de regressão.
version: 1.0.0
platforms:
  - windows
  - linux
  - darwin
waddle:
  recommended_agents:
    - Iris
  required_tools:
    - read_file
    - run_command
---

# Procedimento: Revisão Rigorosa de Código

## Quando Usar
Utilize sempre que for atribuída uma tarefa de revisão de arquivos, validação de pull requests ou checagem de entregas de outros agentes (ex: Nero).

## Critérios de Inspeção
1. **Verificação de Mudanças**:
   - Use `read_file` para examinar os arquivos modificados ou criados.
   - Avalie se as mudanças atendem integralmente ao objetivo solicitado sem efeitos colaterais.
2. **Cobertura de Testes**:
   - Verifique se os novos fluxos de código possuem testes unitários associados.
   - Execute a suíte de testes com `run_command` para atestar se todos os testes passam sem alertas críticos.
3. **Resiliência e Segurança**:
   - Verifique tratamento de erros, exceções e compatibilidade com ambientes offline.
   - Cheque se chaves ou credenciais não foram expostas ou hardcoded.
4. **Parecer de Revisão**:
   - Forneça um feedback estruturado:
     - **Status**: [APROVADO] ou [REQUER AJUSTES].
     - **Pontos Fortes**: O que foi bem implementado.
     - **Riscos / Pendências**: Ajustes prioritários se houver.
