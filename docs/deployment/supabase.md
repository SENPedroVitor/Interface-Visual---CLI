# Deploy cloud do Waddle

Este guia descreve uma primeira topologia para usar o Waddle fora de casa. O
Supabase fornece os serviços gerenciados de dados; ele não executa o FastAPI,
o worker dos agentes, o Ollama ou os CLIs do Codex/Claude.

## Arquitetura

```text
navegador
  ├── frontend React/Vite (Vercel, Cloudflare Pages ou similar)
  └── API REST/WebSocket (Railway, Render, Fly.io ou VPS)
                         │
                         └── Supabase (Postgres, Auth, Storage, Realtime)

bridge local opcional ──┘
  Codex CLI, Claude Code, Ollama, terminal e arquivos do PC
```

> **Importante:** esta primeira fatia é um scaffold de infraestrutura. A API
> atual ainda não valida JWT do Supabase em todas as rotas; não publique o
> container diretamente na internet. Use rede privada ou um proxy autenticado
> até a fatia de autenticação/RLS do backend estar concluída.

O frontend e a API podem ficar online com o PC desligado. O bridge local só
funciona enquanto o PC estiver ligado e conectado. Ele deve ser tratado como
um componente separado e autenticado; não exponha o terminal ou o modo de
acesso total diretamente na internet.

## Pré-requisitos

1. Crie um projeto no [Supabase](https://supabase.com/dashboard) e guarde a
   URL e a chave anon.
2. Configure o Postgres do Supabase para a persistência cloud. A migração do
   SQLite atual precisa ser feita antes do uso em produção; este repositório
   ainda mantém o SQLite como caminho local.
3. Publique a API FastAPI e seu worker em um serviço que mantenha processos
   Python e WebSocket ativos. Configure um health check para `/health`.
4. Publique `web/` como aplicação Vite e defina as variáveis `VITE_*` no
   provedor do frontend.

## Variáveis

Use [.env.cloud.example](../../.env.cloud.example) como checklist. Nunca
commite `.env`, chaves reais ou tokens de serviço.

### API e worker

- `SUPABASE_URL` e `SUPABASE_ANON_KEY` identificam o projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` é opcional e deve existir somente no backend;
  ela ignora políticas RLS e nunca pode chegar ao navegador.
- `DATABASE_URL` deve apontar para o Postgres do Supabase quando a camada de
  persistência cloud estiver habilitada.
- `WADDLE_CORS_ORIGINS` deve conter apenas as origens HTTPS do frontend,
  separadas por vírgula.
- `WADDLE_WS_PUBLIC_URL` (se usado pelo deploy) deve ser a origem `wss://` da API, sem o sufixo `/ws`.
- `WADDLE_AGENT_PROVIDER` pode continuar em `ollama`/`codex` local apenas no
  bridge. Para um worker cloud, configure um provedor HTTP com sua própria
  chave e limite de permissões.

### Frontend

- `VITE_API_URL` é a origem HTTPS pública da API, sem barra final.
- `VITE_WS_URL` é a origem `wss://` correspondente da API (sem `/ws`; o
  frontend acrescenta `/ws/events` e `/ws/terminal/...`).
- Variáveis que começam com `VITE_` são incorporadas no bundle e são públicas.
  Não coloque API keys, `SUPABASE_SERVICE_ROLE_KEY` ou credenciais de CLIs
  nelas.

## CORS, WebSocket e autenticação

1. Restrinja `WADDLE_CORS_ORIGINS` ao domínio publicado; não use `*` com
   cookies ou autenticação.
2. Termine TLS no provedor e encaminhe WebSocket com `wss://`.
3. Valide o token Supabase Auth no backend antes de aceitar mensagens,
   tarefas, arquivos ou comandos.
4. Ative RLS nas tabelas e escreva políticas por usuário/projeto. A chave
   service role deve ser usada apenas em operações server-side indispensáveis.
5. Mantenha logs sem prompts completos, tokens ou valores de headers de
   autenticação.

## Bridge local

Quando uma tarefa precisar do Codex CLI, Claude Code, Ollama, terminal,
filesystem ou Faux Catálogo local, o backend cloud deve enviar uma tarefa para
um bridge instalado no PC. O bridge deve:

- autenticar a conexão de saída com um token rotacionável;
- aceitar somente tarefas explicitamente autorizadas;
- aplicar allowlist de comandos e diretórios;
- iniciar com permissões mínimas (`workspace`), elevando para acesso total
  somente por uma ação local explícita;
- enviar somente eventos/resultados necessários ao backend;
- desligar a conexão quando o usuário revogar a sessão.

Assim, o Waddle cloud continua disponível com o PC desligado, mas os agentes
que dependem dos recursos locais aparecem como offline até o bridge voltar.

## Checklist de publicação

- [ ] Projeto Supabase criado e credenciais armazenadas no secret manager.
- [ ] Schema/migrações PostgreSQL revisados; SQLite não é usado como banco
      compartilhado entre réplicas.
- [ ] API publicada com `/health`, CORS restrito e WebSocket funcional.
- [ ] Worker separado ou processo persistente configurado.
- [ ] Frontend publicado com `VITE_API_URL` e `VITE_WS_URL` HTTPS/WSS.
- [ ] Auth e RLS testados com usuário sem privilégios.
- [ ] Bridge local opcional autenticado e com permissões mínimas.
- [ ] Nenhuma chave aparece no bundle, nos logs ou no Git.
