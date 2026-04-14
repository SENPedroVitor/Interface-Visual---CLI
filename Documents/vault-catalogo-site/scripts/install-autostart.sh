#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/faux/Documents/vault-catalogo-site"
SERVICE_NAME="vault-catalogo-site.service"
SOURCE_SERVICE="$PROJECT_DIR/systemd/$SERVICE_NAME"
SOURCE_ENV_EXAMPLE="$PROJECT_DIR/systemd/vault-catalogo-site.env.example"
TARGET_DIR="$HOME/.config/systemd/user"
TARGET_SERVICE="$TARGET_DIR/$SERVICE_NAME"
TARGET_ENV="$HOME/.config/vault-catalogo-site.env"

mkdir -p "$TARGET_DIR"
cp "$SOURCE_SERVICE" "$TARGET_SERVICE"

if [[ ! -f "$TARGET_ENV" ]]; then
  cp "$SOURCE_ENV_EXAMPLE" "$TARGET_ENV"
  echo "Arquivo de ambiente criado em: $TARGET_ENV"
  echo "Defina OMDB_API_KEY no arquivo para habilitar busca automatica de filme/serie/game."
fi

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"

echo "Servico instalado e iniciado: $SERVICE_NAME"
echo "URL: http://localhost:4173"

echo "\nStatus:"
systemctl --user --no-pager --full status "$SERVICE_NAME" | sed -n '1,20p'
