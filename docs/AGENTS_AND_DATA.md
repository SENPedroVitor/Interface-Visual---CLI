# Agentes principais e fontes de dados

Este documento registra o contrato inicial dos mascotes e evita que o Waddle
trate fontes externas como se fossem mensagens espontâneas.

## Contratos de comportamento

- **Quinta** coordena, responde ao usuário e só convoca a equipe em objetivos
  substanciais ou quando um grupo é aberto explicitamente.
- **Ma** pergunta sobre renda, despesas, reserva, objetivos, prazo e tolerância
  a risco no primeiro contato. Consultas e planilhas só acontecem quando
  solicitadas.
- **Livro** acompanha Atlético Mineiro, Liverpool, Chicago Bears e Chicago
  Bulls. Pesquisa resultados, lesões e notícias apenas sob demanda; Instagram
  não faz parte do escopo.
- **Mosbey** trabalha em `D:\Faux-catalago`. No primeiro contato informa se o
  catálogo está acessível; iniciar servidor, alterar arquivos ou adicionar
  filmes exige pedido explícito.

Nenhum agente inicia conversa, cria mensagem de teste ou envia atualização por
conta própria. Rotinas continuam sendo uma função separada e só devem ser
ativadas pelo usuário.

## Fontes configuráveis

As integrações não incluem chaves no repositório. O Waddle usa fontes públicas
com fallback local e cache:

- Ma: Yahoo Finance Chart sem chave; Alpha Vantage e FRED são opcionais para
  cotações e indicadores macroeconômicos.
- Livro: TheSportsDB como fallback; API-Sports/API-Football pode ser configurada
  para dados atuais. Notícias devem apontar para a fonte oficial do clube ou
  para um feed autorizado. A API do X exige credencial própria.
- Mosbey: serviço local definido por `FAUX_CATALOGO_URL`.

Variáveis opcionais estão listadas em `.env.example`. Sem credencial válida, o
agente não inventa dados atuais: informa a indisponibilidade ou usa somente o
fallback identificado como tal.

## Planilha da Ma

Quando o usuário pedir uma planilha, a ferramenta
`stock_create_investment_sheet` cria um CSV compatível com Excel/LibreOffice em
`WADDLE_DATA_DIR`, com fórmulas de valor investido, valor atual, P/L e
rentabilidade. O arquivo começa vazio para não inventar posições.
