# Waddle — Princípios de Produto inspirados no Grok Bot

## Objetivo

Este documento traduz os principais princípios observados no design do Grok Bot para o contexto do Waddle.

A ideia não é copiar a interface visual do Grok Bot.

A ideia é aproveitar o que ele resolve muito bem:

- agentes como entidades persistentes;
- avatares que comunicam estado;
- coordenação entre múltiplos agentes;
- ferramentas e memória separadas;
- computador/ambiente próprio do agente;
- respostas que usam UI, não apenas texto;
- motion como linguagem funcional;
- redução de ruído na interface.

O Waddle deve parecer menos um “chat com skins diferentes” e mais um **ambiente onde agentes especializados trabalham juntos**.

---

# 1. O agente é o produto, não a conversa

Em um chatbot comum, a unidade principal costuma ser a conversa.

No Waddle, a unidade principal deve ser o **agente**.

Cada agente precisa ter:

- nome;
- avatar;
- função;
- estado;
- memória;
- histórico;
- ferramentas;
- personalidade;
- permissões;
- contexto próprio.

Ao voltar ao Waddle, o usuário não deveria pensar:

> “Vou abrir aquele chat antigo.”

A sensação ideal é:

> “Vou falar com Quinta.”

ou:

> “Vou chamar Atlas.”

---

# 2. Agentes persistentes

Cada agente deve existir como uma entidade estável dentro do sistema.

Exemplo:

```text
Quinta
Coordenação

Atlas
Pesquisa

Nero
Desenvolvimento

Iris
Revisão

Ma
Investimentos
```

O usuário deve aprender quem são esses agentes com o tempo.

Isso aumenta:

- confiança;
- previsibilidade;
- reconhecimento;
- sensação de equipe;
- vínculo com o produto.

---

# 3. O avatar deve comunicar estado

Não depender de badges como:

```text
● Thinking
● Working
● Done
```

O avatar deve ser o primeiro indicador de estado.

Princípio:

> Quinta não TEM um indicador de thinking.
> Quinta É o indicador de thinking.

---

# 4. Estados visuais dos agentes

Cada agente deve ter estados claros.

```ts
type AgentState =
  | "idle"
  | "thinking"
  | "working"
  | "waiting"
  | "blocked"
  | "done"
  | "error"
  | "offline"
```

Esses estados precisam mudar:

- olhos;
- postura;
- deformação do corpo;
- acessórios;
- ritmo;
- motion;
- intensidade visual.

---

# 5. Idle

Idle deve transmitir:

- calma;
- presença;
- disponibilidade;
- personalidade.

Não deve parecer que o agente está “carregando”.

Exemplo:

```text
olhos curiosos
respiração leve
pequenos movimentos ocasionais
```

---

# 6. Thinking

Thinking deve transmitir:

- procura;
- análise;
- exploração.

Possíveis elementos:

- olhos mudando de direção;
- corpo mais ativo;
- órbitas;
- deformação leve;
- ambient glow.

Evitar simplesmente:

```text
spinner
```

---

# 7. Working

Working é diferente de thinking.

Thinking:

```text
explorando
avaliando
decidindo
```

Working:

```text
executando
processando
usando ferramenta
fazendo algo concreto
```

O motion de working deve ser:

- mais estável;
- mais rítmico;
- menos aleatório;
- mais “focado”.

---

# 8. Waiting

Waiting significa:

> “Eu preciso que o usuário faça alguma coisa.”

Nesse estado, o agente pode:

- olhar diretamente para o usuário;
- reduzir movimento;
- inclinar levemente;
- destacar uma ação aguardada.

Exemplo:

```text
Quinta aguarda sua aprovação
```

Mas o avatar já deve sugerir isso antes do texto.

---

# 9. Blocked

Blocked precisa comunicar:

> “Não consigo continuar sozinho.”

Evitar usar apenas um erro vermelho.

Melhor:

- expressão diferente;
- corpo levemente comprimido;
- movimento interrompido;
- pequena reação de frustração ou dúvida.

---

# 10. Done

Ao concluir:

```text
micro reação
↓
estado de sucesso
↓
retorno para idle
```

O sucesso deve ser curto.

Não deixar animações comemorativas repetindo.

---

# 11. Motion é informação

O movimento não deve existir apenas para decoração.

Cada animação deve responder a uma pergunta:

```text
O agente está ativo?
Está pensando?
Está executando?
Está esperando?
Terminou?
Precisa de mim?
```

Se o motion não comunica nada, provavelmente é desnecessário.

---

# 12. Hover revela detalhe

Não mostrar constantemente textos como:

```text
Atlas está pesquisando legislação tributária...
Nero está analisando o código...
Iris está revisando o documento...
```

Isso polui a interface.

Melhor:

```text
avatar em estado de working
```

e, ao hover:

```text
┌──────────────────────────────┐
│ Atlas                        │
│ Pesquisando NCM 8471...      │
│                              │
│ há 12s                       │
└──────────────────────────────┘
```

A interface fica limpa, mas o detalhe continua disponível.

---

# 13. Quinta como coordenadora

Quinta deve funcionar como o principal ponto de entrada do Waddle.

Ela pode ser tratada como uma espécie de:

```text
Chief of Staff
```

Responsabilidades:

- entender a tarefa;
- decidir qual agente usar;
- delegar;
- acompanhar progresso;
- juntar resultados;
- responder ao usuário.

---

# 14. Coordenação multi-agent

Estrutura conceitual:

```text
                   QUINTA
                Coordenação
                    │
        ┌───────────┼───────────┐
        ↓           ↓           ↓
      Atlas        Nero        Iris
     Pesquisa     Dev         Revisão
```

O usuário não deveria precisar gerenciar isso manualmente.

---

# 15. Exemplo de delegação

Usuário:

> Analise esse documento e veja se existe algum problema.

Quinta:

```text
Entendido.

Quinta
  │
  ├──→ Atlas — pesquisando legislação
  │
  └──→ Iris — revisando documento
```

Depois:

```text
Atlas ✓
Iris  ✓
   ↓
Quinta sintetizando...
   ↓
Resposta final
```

---

# 16. Handoff precisa ser visual

Quando um agente delegar uma tarefa, não mostrar apenas:

```text
“Delegando para Atlas.”
```

Mostrar uma transição visual.

Exemplo:

```text
Quinta
  ●
  │
  ↓
  ●
Atlas
```

Possíveis efeitos:

- linha animada;
- partícula viajando;
- avatar do segundo agente surgindo;
- cards conectados;
- pequena transição de foco.

---

# 17. A liderança do Quinta não precisa depender de uma coroa

O problema da coroa atual é que ela parece um emoji.

Ela quebra a linguagem visual porque:

- é detalhada demais;
- parece externa ao personagem;
- tem estética de emoji;
- não combina com o corpo;
- chama atenção mais do que o próprio agente.

A solução ideal é fazer a liderança ser reconhecida por:

- forma;
- comportamento;
- motion;
- posição;
- símbolo próprio;
- função.

---

# 18. Redesenho do Quinta

Em vez de:

```text
👑
Quinta
```

usar uma identidade própria.

Possibilidades:

## Coroa geométrica

```text
  /\  /\
_/  \/  \_
```

## Símbolo de coordenação

```text
◇
Quinta
```

## Três pontos de liderança

```text
●   ●   ●
  Quinta
```

## Halo

```text
 ─────
 Quinta
```

## Forma integrada ao corpo

A própria silhueta do personagem pode ter três pontas.

---

# 19. Melhor opção para Quinta

A melhor direção provavelmente é:

**um símbolo abstrato de liderança integrado à silhueta ou ao motion.**

Assim Quinta não parece:

```text
avatar + emoji
```

e sim:

```text
um personagem desenhado como coordenador desde o início
```

---

# 20. Liderança pode aparecer apenas em contexto

Outra possibilidade interessante:

No idle:

```text
sem símbolo de liderança
```

Ao coordenar agentes:

```text
3 pequenos elementos surgem
↓
orbitam ou se conectam
↓
representam os agentes sob sua coordenação
```

Isso transforma liderança em comportamento.

---

# 21. Memória pertence ao agente

Os agentes não devem ser apenas skins diferentes usando exatamente o mesmo contexto.

Exemplo:

```text
Memória Quinta
└── equipe
└── decisões
└── coordenação
└── prioridades

Memória Atlas
└── pesquisa
└── legislação
└── referências
└── fontes

Memória Nero
└── código
└── arquitetura
└── decisões técnicas

Memória Iris
└── revisão
└── padrões
└── erros recorrentes
```

---

# 22. Ferramentas podem ser compartilhadas

Diferente da memória, muitas ferramentas podem ser globais.

Exemplo:

```text
Ferramentas
├── pesquisar web
├── ler arquivos
├── consultar banco
├── gerar documento
├── executar código
└── usar computador
```

Cada agente recebe apenas as ferramentas permitidas para sua função.

---

# 23. Agentes não podem virar a mesma IA com skins

Se todos tiverem:

- mesma memória;
- mesmas ferramentas;
- mesmo tom;
- mesmo motion;
- mesmas respostas;

o sistema vira:

```text
1 IA
+
5 avatares
```

Isso destrói a ideia de equipe.

Cada agente precisa ter uma especialização real.

---

# 24. O computador do agente

Uma das ideias mais fortes é permitir que o agente tenha um ambiente próprio de trabalho.

Não precisa ficar aberto o tempo inteiro.

Três níveis são suficientes:

## Status

```text
Quinta está usando o computador
```

## Preview

```text
┌──── chat ────┬──── computador ────┐
│              │                     │
│              │ navegador / arquivos│
│              │                     │
└──────────────┴─────────────────────┘
```

## Takeover

```text
[ Assumir controle ]
```

O usuário pode abrir a sessão completa.

---

# 25. A toolbar direita pode representar esse ambiente

Hoje a barra direita do Waddle tem ícones pouco explicativos.

Ela pode assumir funções como:

```text
Computador
Tarefas
Arquivos
Ferramentas
Equipe
Logs
```

Durante uso do computador:

```text
ícone muda de estado
↓
usuário percebe atividade
↓
clica
↓
abre preview
```

---

# 26. Não narrar tudo em texto

Uma IA tende naturalmente a responder:

> Criei três tarefas. A primeira é...

Mas isso muitas vezes deveria ser interface.

Melhor:

```text
┌ Tarefas ──────────────────┐
│ ✓ Conferir XML            │
│ ○ Validar NCM             │
│ ○ Gerar relatório         │
└───────────────────────────┘
```

---

# 27. Generative UI no chat

O chat deve aceitar mais do que mensagens.

Possíveis blocos:

```text
texto
arquivo
imagem
gráfico
tarefa
aprovação
tool call
delegação
resultado
tabela
alerta
checklist
preview
computador
```

---

# 28. Tool calls visíveis

Quando um agente usa uma ferramenta:

```text
┌─────────────────────────┐
│ ⚙ Consultando banco     │
│ ▓▓▓▓▓▓░░░░              │
└─────────────────────────┘
```

Quando termina:

```text
⚙ → ✓
```

O usuário entende o que aconteceu sem precisar de uma longa explicação textual.

---

# 29. Aprovações devem ser UI

Exemplo:

```text
Quinta quer executar:

Gerar relatório fiscal
e salvar em /clientes/acme/

[ Negar ] [ Permitir ]
```

Melhor do que:

> Posso continuar?

---

# 30. O chat não deve ser a única interface

O Waddle pode usar:

- chat;
- sidebar;
- cards;
- preview;
- canvas de tarefas;
- computador;
- painel de equipe;
- status visual;
- widgets.

Isso cria um produto agentic, não apenas um chatbot.

---

# 31. Hierarquia de produto

A ordem mental recomendada:

```text
1. IDENTIDADE
Quem é o agente?

2. ESTADO
O que ele está fazendo?

3. AÇÃO
O que ele pode fazer?

4. CONTEXTO
O que ele sabe?

5. RELAÇÃO
Com quais agentes trabalha?

6. PERSONALIDADE
Como ele se comporta?

7. DECORAÇÃO
Como tudo fica bonito?
```

Não começar pelo visual.

---

# 32. Personalidade funcional

A personalidade deve nascer da função.

## Quinta

```text
calma
segura
organizada
coordenadora
```

## Atlas

```text
curioso
investigativo
explorador
```

## Nero

```text
técnico
preciso
objetivo
```

## Iris

```text
metódica
atenta
crítica
```

## Ma

```text
prudente
analítica
estável
```

---

# 33. Motion por função

Exemplo:

## Quinta

```text
movimentos amplos e suaves
pouca ansiedade
ritmo estável
```

## Atlas

```text
olhos rápidos
movimento exploratório
pequenos deslocamentos
```

## Nero

```text
snaps
movimento angular
pulsos curtos
```

## Iris

```text
movimento horizontal
ritmo de leitura
controle
```

---

# 34. Sidebar como representação da equipe

A sidebar não deve parecer apenas uma lista de chats.

Ela representa a equipe.

Cada agente pode mostrar:

- avatar;
- função;
- estado;
- presença;
- tarefa atual;
- atividade recente.

Mas com pouco ruído.

---

# 35. Exemplo de sidebar

```text
Quinta
Coordenação
● Online

Atlas
Pesquisa
◌ Working

Nero
Desenvolvimento
● Online

Iris
Revisão
✓ Done
```

O texto de estado pode aparecer apenas no hover, dependendo da densidade desejada.

---

# 36. Motion budget

Não animar todos os agentes ao mesmo tempo.

Princípio:

```text
1 agente em foco
↓
motion perceptível

agentes periféricos
↓
motion mínimo
```

Caso contrário, a interface fica barulhenta.

---

# 37. Informações em camadas

A interface deve mostrar apenas o nível necessário de informação.

## Nível 1

```text
avatar mudou
```

O usuário sabe que algo está acontecendo.

## Nível 2

```text
hover
↓
“Pesquisando legislação”
```

## Nível 3

```text
click
↓
detalhes da tarefa
```

## Nível 4

```text
abrir computador
↓
ver ação acontecendo
```

Isso reduz poluição visual.

---

# 38. O avatar central precisa ser maior

Na tela atual do Waddle, o avatar principal ainda está pequeno para sua importância.

Recomendação:

```text
110–150px idle
```

Estados especiais podem crescer um pouco.

O objetivo é fazer o usuário sentir que está falando com um personagem, não com um ícone.

---

# 39. O nome e cargo não precisam competir com o avatar

Estrutura:

```text
[ avatar ]

Quinta
Coordenação · Online

Mais um dia, mais uma missão.
```

O avatar deve ser o elemento visual principal.

---

# 40. Composer conectado ao agente

Quando o usuário focar o input:

```text
Quinta olha para o composer
```

Quando começa a digitar:

```text
Quinta mantém atenção
```

Quando envia:

```text
Quinta reage
↓
entra em thinking
```

Isso cria continuidade entre usuário e personagem.

---

# 41. Fluxo completo

## Usuário abre Quinta

```text
Quinta em idle
```

## Usuário digita

```text
olhos → composer
```

## Usuário envia

```text
reação
↓
thinking
```

## Quinta decide delegar

```text
handoff → Atlas
handoff → Iris
```

## Atlas pesquisa

```text
Atlas working
```

## Iris revisa

```text
Iris working
```

## Quinta recebe os resultados

```text
Quinta sintetizando
```

## Quinta responde

```text
streaming
↓
done
↓
idle
```

---

# 42. Visão futura do Waddle

O Waddle pode evoluir para:

```text
Equipe humana
+
Equipe de agentes
+
Projetos
+
Ferramentas
+
Memória
+
Computadores
+
Automação
+
Chat
```

Tudo conectado.

---

# 43. O diferencial

O diferencial não deve ser:

```text
“Temos vários chatbots.”
```

Deve ser:

```text
“Você trabalha com uma equipe de agentes especializados.”
```

---

# 44. O princípio mais importante

> O Waddle não deve parecer um chat com cinco skins diferentes.

Ele deve parecer:

> **um ambiente persistente onde agentes especializados têm identidade, memória, ferramentas, responsabilidades e trabalham juntos.**

Motion, UI e arquitetura devem reforçar essa ideia em todas as telas.

---

# Prioridades recomendadas

## Fase 1 — Identidade

1. Redesenhar Quinta
2. Remover a coroa estilo emoji
3. Definir símbolo de coordenação
4. Aumentar avatar central
5. Definir identidade visual dos outros agentes

## Fase 2 — Estado

6. Idle
7. Thinking
8. Working
9. Waiting
10. Done
11. Error / Blocked

## Fase 3 — Coordenação

12. Handoff visual
13. Delegação por Quinta
14. Estado de cada agente na sidebar
15. Síntese de resultados

## Fase 4 — UI Agentic

16. Tool calls
17. Cards
18. Aprovações
19. Tarefas
20. Computer preview
21. Takeover

## Fase 5 — Inteligência persistente

22. Memória por agente
23. Ferramentas por função
24. Histórico por agente
25. Projetos compartilhados
26. Rotinas e automações
