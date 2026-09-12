---
name: test-driven-development
description: Procedimento de desenvolvimento guiado por testes (Red -> Green -> Refactor).
version: 1.0.0
platforms:
  - windows
  - linux
  - darwin
waddle:
  recommended_agents:
    - Nero
  required_tools:
    - read_file
    - write_file
    - run_command
---

# Procedimento: Test-Driven Development (TDD)

## Quando Usar
Utilize sempre que implementar novas funcionalidades, correções de bugs ou refatorações de código.

## Ciclo TDD
1. **Red (Escreva o Teste)**:
   - Crie ou edite um arquivo de teste na pasta `tests/` especificando o comportamento esperado.
   - Execute o teste usando `run_command` e confirme que ele falha pelo motivo correto.
2. **Green (Implementação Mínima)**:
   - Escreva apenas a quantidade estritamente necessária de código de produção para fazer o teste passar.
   - Não adicione abstrações desnecessárias ou código não testado nesta fase.
   - Execute novamente o teste para confirmar aprovação.
3. **Refactor (Limpeza e Otimização)**:
   - Limpe o código, remova duplicidades e melhore a legibilidade mantendo os comentários relevantes.
   - Execute toda a suíte de testes do projeto para garantir zero regressões.
4. **Finalização**:
   - Conclua a tarefa com um resumo claro dos testes adicionados e das mudanças feitas.
