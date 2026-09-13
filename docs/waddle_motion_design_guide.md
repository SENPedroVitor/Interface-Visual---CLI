# Waddle — Guia de Motion Design e Identidade dos Agentes

## Visão geral

O objetivo do motion no Waddle não deve ser simplesmente “deixar a interface bonita”. O movimento precisa comunicar estado, intenção, personalidade, hierarquia, progresso e relação entre usuário, agente e sistema.

A principal oportunidade do produto está em fazer os agentes parecerem **personagens que habitam a interface**, e não apenas avatares estáticos dentro de um chatbot.

## 1. O agente precisa dominar a cena

Na tela principal, o agente selecionado é o protagonista.

Hoje existe bastante espaço vazio no centro, enquanto o avatar ocupa pouco espaço visual. A recomendação é aumentar sua presença e aproximar os elementos relacionados.

Estrutura recomendada:

```text
Avatar
↓
Nome do agente
Cargo · Status
↓
Mensagem contextual
↓
Ações sugeridas
↓
Composer
```

Escala sugerida:

- Avatar idle: aproximadamente `110–150px`
- Estados especiais: até `130–170px`
- Evitar simplesmente aplicar `scale()`
- O aumento precisa vir acompanhado de mais detalhe no personagem

## 2. Não animar o avatar inteiro: animar o personagem

Evitar o clássico:

```tsx
animate={{
  y: [0, -5, 0]
}}
```

Esse tipo de movimento faz o avatar parecer um ícone flutuando.

O ideal é animar a anatomia:

- corpo;
- olhos;
- acessórios;
- expressão;
- deformação;
- orientação;
- pequenos atrasos entre partes.

Exemplo de idle:

```text
corpo
scaleX: 1 → 1.015 → .995 → 1

scaleY:
1 → .99 → 1.01 → 1

olhos:
movimentos independentes de 1–3px
```

## 3. Evitar loops perfeitamente repetitivos

Movimento repetido no mesmo intervalo parece artificial.

Evitar:

```text
olhar para a direita a cada 4 segundos
```

Preferir variação:

```text
2.5s
4.7s
3.1s
6.2s
```

Os olhos podem usar pequenas saccades:

```ts
x: random(-2, 2)
y: random(-1, 1)
```

Às vezes o personagem simplesmente não faz nada.

A ausência de movimento também é motion design.

## 4. State machine para os agentes

Criar estados explícitos desde o início.

```ts
type AgentState =
  | "idle"
  | "hover"
  | "listening"
  | "reading"
  | "thinking"
  | "working"
  | "waiting"
  | "success"
  | "warning"
  | "error"
  | "offline"
```

Cada estado deve ter uma linguagem visual própria.

## 5. Estado: idle

O idle deve ser quase imperceptível.

Movimento:

- respiração lenta;
- pequenas deformações do corpo;
- micro movimentos dos olhos;
- acessórios com pequena inércia;
- evitar bounce contínuo.

Timing:

- corpo: `4–7s`
- olhos: intervalos variáveis
- acessórios: reação atrasada de `30–80ms`

## 6. Estado: hover

Não usar apenas:

```text
scale: 1.05
```

Melhor:

- olhos acompanham levemente o cursor;
- corpo inclina `1–2°`;
- escala máxima próxima de `1.02–1.03`.

Eye tracking:

```ts
maxX = 3
maxY = 2
```

Nunca deixar os olhos encostarem na borda do rosto.

Quando o cursor sai:

```text
olhos → centro
```

com spring leve.

## 7. Quando o usuário começa a digitar

Ao focar o composer:

```text
agente olha para baixo
↓
composer ganha presença
```

O personagem percebe que o usuário começou uma interação.

Composer em focus:

```text
y: -2px
borda: levemente mais clara
shadow: mais presente
```

Evitar glow neon.

## 8. Estado: listening

Ao ativar o microfone:

- corpo reage levemente à amplitude;
- evitar pulsação exagerada;
- ondas podem surgir ao redor do avatar.

Exemplo:

```ts
scaleY = 1 + audioAmplitude * 0.03
```

## 9. Estado: thinking

O efeito de órbitas é ideal aqui.

Importante: ele não deve ficar ativo o tempo inteiro.

Entrada:

```text
opacity: 0 → 1
scale: .8 → 1
strokeDashoffset: 100 → 0
```

Depois as órbitas começam a girar.

Velocidades diferentes:

```text
roxa:   5.7s
verde:  7.4s
azul:   6.2s
rosa:   8.1s
```

Nunca usar o mesmo tempo para todas.

## 10. Profundidade nas órbitas

Separar:

```text
órbita traseira
avatar
órbita frontal
```

Assim o personagem parece tridimensional.

Também é possível variar opacidade:

```text
atrás: .7
frente: 1
```

## 11. Thinking e Working precisam ser diferentes

### Thinking

Sensação:

- curiosidade;
- exploração;
- movimento;
- olhos procurando;
- órbitas vivas.

### Working

Sensação:

- foco;
- estabilidade;
- ritmo;
- progresso;
- menos movimento aleatório.

Possíveis efeitos:

- olhos mais estreitos;
- sweep de luz;
- pulso rítmico;
- indicador de tarefa ativo.

## 12. Estado: success

Usar spring apenas uma vez.

Exemplo:

```text
scale
1
↓
.96
↓
1.08
↓
1
```

Configuração aproximada:

```ts
type: "spring"
stiffness: 350
damping: 18
```

Acessórios podem reagir com pequeno atraso.

## 13. Estado: error

Evitar:

- vermelho piscando;
- shake exagerado;
- animação de erro de formulário.

Preferir:

```text
x: 0 → -2 → 2 → 0
```

ou:

- corpo comprime;
- olhos encolhem;
- personagem recua levemente.

## 14. Personalidade por agente

Cada agente não deve apenas ter uma cor diferente.

O motion deve refletir a função.

### Quinta — Coordenação

- movimento calmo;
- estável;
- simétrico;
- seguro;
- menos agitação.

### Atlas — Pesquisa

- olhos explorando;
- movimentos rápidos;
- curiosidade;
- atenção lateral.

### Nero — Desenvolvimento

- movimento mais angular;
- pequenos snaps;
- pulsos;
- precisão técnica.

### Iris — Revisão

- leitura horizontal;
- movimentos suaves;
- controle;
- ritmo metódico.

### Ma — Investimentos

- movimento lento;
- preciso;
- estabilidade;
- pequenos elementos de gráfico/sparkline quando fizer sentido.

## 15. Shared transitions na sidebar

Troca de agente não deve parecer troca de página.

Usar transição compartilhada:

```tsx
<motion.div layoutId="activeAgent" />
```

O indicador selecionado pode deslizar entre agentes em vez de desaparecer.

Resultado:

```text
┃ Quinta
┃
┃
↓
┃ Atlas
```

A barra de seleção se move fisicamente.

## 16. Sidebar selecionada está visualmente pesada

O bloco selecionado deve ser mais leve.

### Idle

- background quase invisível.

### Hover

- fundo `+3–5%` mais claro;
- avatar `scale: 1.03`;
- nome `x: +2px`.

### Selected

- fundo mais claro;
- barra lateral roxa;
- contraste controlado.

## 17. Composer

O composer é um dos elementos mais importantes da interface.

Hoje ele pode ganhar mais comportamento.

### Normal

```text
posição estável
```

### Hover

```text
borda levemente mais clara
```

### Focus

```text
y: -2px
shadow aumenta
background sobe levemente
```

Evitar efeitos excessivos.

## 18. Botão +

O botão `+` pode virar um pequeno elemento de transformação.

### Hover

```text
rotate: 90deg
```

Tempo:

```text
~220ms
```

### Clique

Transformar:

```text
+ → ×
```

com spring leve.

As opções podem nascer do próprio botão:

```text
        arquivo
        imagem
        tela
      ↗
     +
```

Melhor do que abrir um modal desconectado.

## 19. Botão enviar

Quando houver texto:

```text
cinza → ativo
```

Ao clicar:

```text
scale 1 → .88 → 1
```

A seta pode sair da área do botão e ser substituída por:

```text
■
```

durante geração, funcionando como “parar”.

## 20. Ações sugeridas

As sugestões centrais podem ter stagger na entrada.

Exemplo:

```text
avatar      0ms
nome       80ms
descrição 140ms
ação 1    220ms
ação 2    270ms
ação 3    320ms
composer  380ms
```

Essa entrada acontece apenas quando fizer sentido, não a cada render.

Hover:

```text
x: +3px
```

ou:

```text
scale: 1.01
```

Seta opcional:

```text
Analise a arquitetura →
```

com:

```text
opacity: 0 → 1
x: -4 → 0
```

## 21. Toolbar direita

Os ícones têm pouco affordance.

Usar tooltips com atraso:

```text
delay: ~350ms
```

Evitar tooltip instantâneo, pois cria ruído enquanto o cursor atravessa a barra.

### Idle

```text
opacity: .7
```

### Cursor próximo

```text
opacity: 1
```

## 22. Profundidade da interface

Criar três planos:

```text
Plano 1
Background

Plano 2
Sidebars / conteúdo

Plano 3
Avatar / composer / overlays
```

Motion reforça profundidade.

### Ao focar composer

```text
background: levemente mais escuro
composer: y -2px
```

### Ao abrir modal

```text
conteúdo atrás: scale .985
blur: 2–4px
```

Usar blur com moderação.

## 23. Ambient glow

Evitar partículas decorativas.

Melhor usar um glow radial quase invisível atrás do agente.

Exemplo:

```css
radial-gradient(
  rgba(124, 58, 237, .06),
  transparent 60%
)
```

Quando entra em thinking:

```text
6% → 10%
```

lentamente.

## 24. Status Online

Não manter o pontinho verde pulsando eternamente.

Melhor:

```text
offline → online

○
↓
●
↓
ring expand
```

Depois fica estático.

Motion deve comunicar mudança, não decoração.

## 25. Mensagens

Entrada:

```text
opacity: 0 → 1
y: 6 → 0
```

Tempo:

```text
180–240ms
```

Evitar animação exagerada letra por letra.

O próprio streaming já é motion suficiente.

## 26. Tool calls

Mostrar claramente quando um agente está executando uma ferramenta.

Exemplo:

```text
┌────────────────────────┐
│ ⚙ Lendo balanco.xlsx   │
│ ▓▓▓▓▓▓░░░░             │
└────────────────────────┘
```

Ao finalizar:

```text
⚙ → ✓
```

O card pode contrair levemente.

## 27. Multi-agent handoff

Grande oportunidade de identidade visual.

Se Quinta delega para Atlas:

```text
Quinta
  ↓
Atlas
```

Mostrar os dois avatares.

Exemplo:

```text
        Quinta
          ●
          │
          ↓
          ●
        Atlas
```

Também pode haver uma pequena partícula viajando entre eles.

Isso transforma delegação em linguagem visual própria do produto.

## 28. Motion budget

Não animar tudo ao mesmo tempo.

Em idle:

```text
1 elemento principal
pode ter movimento perceptível.

2–3 elementos
podem ter movimento quase imperceptível.

todo o resto
fica parado.
```

Quando Quinta é o foco, os agentes periféricos praticamente congelam.

## 29. Física dos acessórios

Acessórios precisam de massa própria.

Exemplo:

```text
avatar rotate: 2°
acessório rotate: 1°
delay: 30–60ms
```

Isso cria inércia.

## 30. Motion tokens

Definir tokens antes de espalhar animações pelo produto.

| Uso | Tempo |
|---|---:|
| Hover pequeno | 120–160ms |
| Botão | 160–200ms |
| Sidebar selection | 180–240ms |
| Tooltip | 160–220ms |
| Menu/popover | 220–280ms |
| Troca de agente | 280–380ms |
| Painel grande | 350–480ms |
| Idle avatar | 4–7s |
| Ambient motion | 6–12s |

Easings:

```ts
const motion = {
  fast: [0.2, 0, 0, 1],
  smooth: [0.4, 0, 0.2, 1],
  expressive: [0.16, 1, 0.3, 1],
}
```

## 31. Spring não deve ser usado em tudo

Spring funciona bem para:

- avatar;
- drag;
- botões;
- elementos físicos;
- transformações.

Para:

- opacity;
- background;
- texto;
- tooltips;

preferir easing.

Caso contrário, tudo parece gelatina.

## 32. Reduced Motion

Implementar:

```css
@media (prefers-reduced-motion: reduce)
```

Nesse modo:

- remover órbitas contínuas;
- remover morph constante;
- reduzir springs;
- manter fades simples;
- preservar feedback funcional.

## 33. Performance

Priorizar animações em:

```text
transform
opacity
```

Evitar uso contínuo de:

```text
width
height
top
left
box-shadow pesado
blur grande
```

SVG é uma boa opção para o avatar principal.

## 34. Fluxo ideal da experiência

### Entrada

```text
sidebar entra
↓
Quinta aparece
↓
respiração pequena
↓
nome
↓
descrição
↓
sugestões
↓
composer
```

### Hover no agente

```text
olhos seguem cursor
```

### Focus no composer

```text
Quinta olha para baixo
composer sobe 2px
```

### Usuário digita

```text
Quinta permanece atento
```

### Envio

```text
botão reage
sugestões saem
Quinta entra em thinking
órbitas surgem
```

### Tool call

```text
órbitas desaceleram
card de tarefa aparece
```

### Resposta

```text
órbitas recolhem
Quinta olha para a mensagem
streaming começa
```

### Finalização

```text
micro reação de sucesso
↓
retorno lento para idle
```

## 35. A coroa do Quinta precisa ser redesenhada

A coroa atual é um dos elementos que mais enfraquece a identidade visual do agente.

Ela parece um **emoji colocado sobre o personagem**, e não uma parte do mesmo sistema visual.

O problema não é a ideia de “coroa”.

O problema é a execução.

### Problemas atuais

- linguagem gráfica diferente do corpo;
- detalhamento excessivo comparado ao avatar;
- aparência de emoji;
- cores muito saturadas;
- parece um sticker externo;
- não compartilha espessura de traço;
- não parece pertencer ao personagem;
- chama atenção demais.

Isso reduz a sensação de produto próprio.

## 36. Alternativas para a coroa

### Opção A — Coroa minimalista

Usar uma coroa extremamente simplificada:

```text
  /\  /\
_/  \/  \_
```

Características:

- 1 ou 2 cores;
- mesma linguagem geométrica do avatar;
- sem brilho;
- sem contorno de emoji;
- cantos arredondados.

Essa seria a opção mais segura.

### Opção B — Coroa como parte do corpo

Em vez de ficar “em cima”, fazer a silhueta do Quinta já nascer com três pontas.

Exemplo:

```text
      /\ /\ /\
    ╭──────────╮
    │  •    •  │
    ╰──────────╯
```

Isso integra o cargo ao personagem.

É provavelmente a solução mais forte para identidade.

### Opção C — Halo / marcador de liderança

Substituir a coroa por um elemento abstrato:

```text
      ━━━
     Quinta
```

ou:

```text
       ◇
     Quinta
```

Pode ser:

- halo;
- arco;
- anel;
- três pequenos pontos;
- pequena forma geométrica flutuante.

Isso comunica liderança sem usar símbolo literal de rei/rainha.

### Opção D — “Coroa orbital”

Usar o próprio motion como símbolo.

No idle:

```text
sem coroa
```

Quando Quinta assume coordenação:

```text
3 pequenos elementos orbitam acima da cabeça
```

Assim a liderança vira comportamento, não emoji.

### Opção E — Marca de função

Criar um pequeno glyph próprio para “coordenação”.

Por exemplo:

```text
⌁
△
◇
⋈
```

O importante é ser um símbolo desenhado especificamente para o Waddle.

Ele pode aparecer:

- no avatar;
- na sidebar;
- no título;
- em badges;
- em tooltips.

Isso cria um mini sistema de iconografia do produto.

## 37. Recomendação para o Quinta

A recomendação principal é:

**remover a coroa emoji atual.**

Substituir por uma dessas duas soluções:

1. **coroa geométrica minimalista integrada ao corpo**;
2. **símbolo abstrato de coordenação criado para o Waddle**.

Se quiser manter a ideia de coroa, ela deve parecer ter sido desenhada pelo mesmo artista que criou o avatar.

## 38. Prioridade de implementação

### Fase 1

1. Redesenhar o avatar do Quinta
2. Remover a coroa estilo emoji
3. Criar state machine
4. Criar idle
5. Criar thinking
6. Criar success

### Fase 2

7. Eye tracking
8. Composer reativo
9. Shared transition na sidebar
10. Tool calls animados
11. Handoff multi-agent

### Fase 3

12. Personalidade própria por agente
13. Física de acessórios
14. Ambient glow
15. Microinterações completas
16. Reduced Motion
17. Refinamento de performance

## Princípio central

> O Waddle não deve parecer um chatbot com avatares.  
> Deve parecer um ambiente onde agentes vivos trabalham dentro da interface.

O motion é o principal elemento capaz de transformar essa ideia em percepção real para o usuário.
