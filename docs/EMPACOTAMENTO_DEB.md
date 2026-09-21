# Empacotamento Debian/Ubuntu

O pacote nativo Linux do Waddle e montado por `scripts/build_deb.sh` com
`dpkg-deb`, sem exigir root. O script usa `pyproject.toml` como fonte da versao,
normaliza permissoes e timestamps, e respeita `SOURCE_DATE_EPOCH` para builds
reproduziveis.

```bash
SOURCE_DATE_EPOCH=1700000000 scripts/build_deb.sh
```

Por padrao, o artefato sai em:

```text
dist/deb/waddle_0.1.0_all.deb
```

O pacote instala:

- `/usr/bin/waddle-desktop`, wrapper do entrypoint nativo Qt/QML.
- `/usr/lib/waddle/src`, runtime Python compartilhado do Waddle.
- `/usr/lib/waddle/skills` e `/usr/lib/waddle/assets`, recursos carregados pelo runtime.
- `/usr/share/applications/waddle.desktop`, launcher do menu.
- `/usr/share/icons/hicolor/scalable/apps/waddle.svg`, icone do app.

As dependencias de runtime ficam declaradas no controle Debian em
`packaging/linux/control.in`, incluindo Python 3, FastAPI/Uvicorn, Pydantic,
PySide6 e bibliotecas Qt/X11 comuns para o shell desktop.

## Verificacao

```bash
python3 -m unittest tests.test_deb_packaging
```

Os testes constroem o `.deb` dentro de um diretorio temporario, extraem o
conteudo com `dpkg-deb -x`, validam os campos de controle, checam launcher,
arquivo `.desktop`, icone e confirmam que duas montagens com
`SOURCE_DATE_EPOCH` fixo geram o mesmo hash.

## Limitacoes

Este pacote nao vendora wheels Python nem um interpretador proprio; ele depende
dos pacotes Python/Qt disponiveis na distribuicao Debian/Ubuntu alvo. A validacao
automatizada nao executa instalacao real via `apt` nem abre a interface grafica,
porque foi desenhada para rodar sem root e sem servidor grafico.
