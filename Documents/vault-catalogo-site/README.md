# Catalogo pessoal com Obsidian como banco

Esse projeto gera um site estatico lendo os markdowns do seu vault:

- `Filmes`
- `📺 Series`
- `📚 Livros`
- `🎮 Games`
- `Musicas/Albums`
- `Catalogo/Outros`

As capas sao copiadas automaticamente para `dist/assets` quando existirem.

## Como usar localmente

```bash
cd /home/faux/Documents/vault-catalogo-site
npm run build
npm run dev
```

Abra: `http://localhost:4173`

## Inserir novo item pelo site

A pagina agora tem formulario para criar item novo no vault.

Fluxo:

1. Escolher tema (filme/serie/livro/game/musica/outros)
2. Buscar metadados automaticos (titulo ou ID)
3. Aplicar resultado
4. Ajustar campos manuais se quiser
5. Salvar no Obsidian

Ao salvar, o sistema:

- cria o `.md` na pasta correta
- baixa capa automaticamente para `Capas`
- executa build de novo
- atualiza o catalogo

## Busca automatica por metadados

- `filmes`, `series`, `games`: OMDb (API compativel com IMDb IDs)
- `livros`: OpenLibrary
- `musicas`: iTunes Search API

Para filme/serie/game, configure sua chave:

```bash
cp /home/faux/Documents/vault-catalogo-site/systemd/vault-catalogo-site.env.example ~/.config/vault-catalogo-site.env
nano ~/.config/vault-catalogo-site.env
```

No arquivo, defina:

```bash
OMDB_API_KEY=sua_chave
```

Depois reinicie o servico:

```bash
systemctl --user daemon-reload
systemctl --user restart vault-catalogo-site.service
```

## Rodar automatico ao ligar (autostart)

Instala o servico de usuario do systemd:

```bash
cd /home/faux/Documents/vault-catalogo-site
./scripts/install-autostart.sh
```

Comandos uteis:

```bash
systemctl --user status vault-catalogo-site.service
systemctl --user restart vault-catalogo-site.service
systemctl --user stop vault-catalogo-site.service
systemctl --user disable vault-catalogo-site.service
```

## Estrutura

- `scripts/build.mjs`: le o vault e gera `dist`
- `scripts/serve.mjs`: servidor local + API de cadastro/metadata
- `scripts/start-service.sh`: comando de inicializacao para systemd
- `scripts/install-autostart.sh`: instala e habilita autostart
- `systemd/vault-catalogo-site.service`: unidade systemd de usuario
- `src/*`: interface do site
