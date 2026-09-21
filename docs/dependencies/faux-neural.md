# Faux-Neural

## Origem

- URL: https://github.com/SENPedroVitor/Faux-Neural.git
- Caminho no Waddle: `third_party/faux-neural`
- Tipo de integração: git submodule
- SHA fixado: `528ce9f703b5f9da749737be3f7be05345cbb983`
- Data do registro: 2026-09-21
- Fonte do SHA: cópia local existente em `/home/faux/Documentos/Redenueral/Faux-Neural`

## Licença

Não foi encontrado arquivo de licença na raiz da cópia local (`LICENSE`, `LICENCE`, `COPYING` ou variações) no SHA registrado. Antes de distribuir artefatos que incluam ou empacotem conteúdo do submódulo, revisar a licença upstream ou obter autorização explícita.

## Dependências observadas

Não há manifesto de dependências observado na raiz da cópia local (`requirements.txt`, `pyproject.toml` ou `package.json`). A inspeção dos imports e scripts indica:

- Python padrão: `argparse`, `datetime`, `json`, `os`, `pathlib`, `re`, `sqlite3`, `struct`, `subprocess`, `sys`, `typing`.
- Python externo: `fastapi`, `pydantic`, `numpy`, `PIL`/Pillow.
- Web/JS: Three.js via CDN em `index.html` e `js/GLTFLoader.js` versionado no próprio repositório.
- Artefatos locais: modelos `.glb`, banco SQLite e binários de pesos presentes no upstream.

Essas dependências são apenas observadas no submódulo. Elas não devem ser adicionadas ao runtime principal do Waddle sem uma integração funcional e revisão separada.

## Regras de sincronização

- Atualizar o conteúdo apenas por comandos de submódulo Git, mantendo `third_party/faux-neural` como gitlink.
- Não copiar arquivos do Faux-Neural para `src/` ou para pacotes do Waddle.
- Ao avançar o submódulo, registrar o novo SHA neste arquivo no mesmo commit que altera o gitlink.
- Verificar presença de licença a cada atualização upstream.
- Registrar novas dependências observadas quando houver mudança de manifesto, import relevante ou asset obrigatório.
- Rodar `scripts/check_faux_neural.sh` após alterações de submódulo para reportar divergências sem modificar o código.
