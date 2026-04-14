#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/faux/Documents/vault-catalogo-site"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # Load nvm so npm/node from your configured version are available in systemd.
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
fi

cd "$PROJECT_DIR"
exec npm run dev
