#!/bin/sh
set -eu

export WADDLE_API_HOST="${WADDLE_API_HOST:-0.0.0.0}"
export WADDLE_API_PORT="${WADDLE_API_PORT:-8000}"
export WADDLE_DATA_DIR="${WADDLE_DATA_DIR:-/data}"

exec uvicorn waddle.api.server:app \
  --app-dir /app/src \
  --host "$WADDLE_API_HOST" \
  --port "$WADDLE_API_PORT"
