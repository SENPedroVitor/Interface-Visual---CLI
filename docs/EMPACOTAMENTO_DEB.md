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
- `/usr/lib/waddle/requirements.txt`, lista de dependencias Python instalada no
  venv privado durante a configuracao do pacote.
- `/usr/lib/waddle/skills` e `/usr/lib/waddle/assets`, recursos carregados pelo runtime.
- `/usr/share/applications/waddle.desktop`, launcher do menu.
- `/usr/share/icons/hicolor/scalable/apps/waddle.svg`, icone do app.

As dependencias de runtime ficam declaradas no controle Debian em
`packaging/linux/control.in`. Para Linux Mint 22.3/Ubuntu 24.04, o pacote nao
depende de `python3-pyside6`, porque esse pacote apt nao existe nessas bases.
Em vez disso, o `postinst` cria um venv isolado em `/usr/lib/waddle/venv` e
executa `pip install --prefer-binary -r /usr/lib/waddle/requirements.txt`.

O `Depends` fica limitado a pacotes apt disponiveis na base Mint/Ubuntu:
`python3`, `python3-venv`, `ca-certificates`, `libgl1`, `libegl1`,
`libxkbcommon-x11-0` e `libxcb-cursor0`. `libxcb-cursor0` cobre a dependencia
do plugin Qt xcb usada por Qt/PySide6 recentes.

O launcher do menu continua chamando `waddle-desktop`, mas o wrapper agora usa
`/usr/lib/waddle/venv/bin/python`. Se o venv nao existir, ele mostra uma mensagem
orientando a refazer a configuracao do pacote com `sudo apt --fix-broken install`.

## Verificacao

```bash
python3 -m unittest tests.test_deb_packaging
```

Os testes constroem o `.deb` dentro de um diretorio temporario, extraem o
conteudo com `dpkg-deb -x`, validam os campos de controle, checam launcher,
arquivo `.desktop`, icone, scripts `postinst`/`postrm` e confirmam que duas
montagens com `SOURCE_DATE_EPOCH` fixo geram o mesmo hash. A suite tambem roda o
`postinst` em ambiente simulado sem root, usando um Python falso para validar a
criacao do venv, o comando de `pip` e a mensagem de falha quando o download de
dependencias nao pode ser concluido.

## Limitacoes

Este pacote nao vendora wheels Python nem um interpretador proprio. A instalacao
real via `sudo apt install ./waddle_0.1.0_all.deb` precisa de acesso ao indice
Python configurado para o `pip` no momento do `postinst`, ou de um mirror/cache
de wheels ja configurado no sistema. Se a maquina estiver offline, a configuracao
do pacote falha com mensagem explicita e pode ser tentada novamente com
`sudo apt --fix-broken install` apos restaurar rede, proxy, certificados ou
mirror.

A validacao automatizada nao executa instalacao real via `apt` nem abre a
interface grafica, porque foi desenhada para rodar sem root e sem servidor
grafico.
