#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.release.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.release}"

cd "$ROOT_DIR"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${DOMAIN:=playblockopoly.com}"
: "${CERTBOT_EMAIL:?Set CERTBOT_EMAIL in $ENV_FILE or the environment}"

mkdir -p "$ROOT_DIR/nginx/certbot/www" "$ROOT_DIR/nginx/certbot/conf"

docker compose -f "$COMPOSE_FILE" stop nginx >/dev/null 2>&1 || true

docker run --rm \
  --network host \
  -v "$ROOT_DIR/nginx/certbot/conf:/etc/letsencrypt" \
  certbot/certbot certonly \
    --standalone \
    --email "$CERTBOT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

docker compose -f "$COMPOSE_FILE" up -d nginx

echo "Certificate issued for ${DOMAIN}."
