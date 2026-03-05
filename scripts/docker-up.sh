#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker/docker-compose.yml"
DOCKER_BIN="${DOCKER_BIN:-docker}"
if [ -d "/Applications/Docker.app/Contents/Resources/bin" ]; then
  export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
fi


if ! command -v "$DOCKER_BIN" >/dev/null 2>&1; then
  if [ -x "/Applications/Docker.app/Contents/Resources/bin/docker" ]; then
    DOCKER_BIN="/Applications/Docker.app/Contents/Resources/bin/docker"
  else
    echo "[docker-up] docker binary not found. Set DOCKER_BIN or add docker to PATH."
    exit 1
  fi
fi

# Load project .env so compose variable substitution can pick up API keys.
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ROOT_DIR/.env"
  set +a
fi

echo "[docker-up] starting services..."
"$DOCKER_BIN" compose -f "$COMPOSE_FILE" up -d --build

echo "[docker-up] waiting for api health..."
for i in {1..60}; do
  if curl -fsS http://localhost:4000/health >/dev/null 2>&1; then
    echo "[docker-up] api is healthy"
    exit 0
  fi
  sleep 2
done

echo "[docker-up] api health check timed out"
exit 1
