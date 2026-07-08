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

docker run --rm \
  -v "$ROOT_DIR/nginx/certbot/www:/var/www/certbot" \
  -v "$ROOT_DIR/nginx/certbot/conf:/etc/letsencrypt" \
  certbot/certbot renew \
    --non-interactive \
    --no-random-sleep-on-renew \
    --webroot \
    -w /var/www/certbot

docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload

echo "Certificate renewal check complete for ${DOMAIN}."
