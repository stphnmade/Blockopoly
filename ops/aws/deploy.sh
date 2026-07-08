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

: "${IMAGE_NAMESPACE:?Set IMAGE_NAMESPACE in $ENV_FILE or the environment}"
: "${IMAGE_TAG:=main}"
: "${IMAGE_REGISTRY:=ghcr.io}"

echo "Deploying Blockopoly images from ${IMAGE_REGISTRY}/${IMAGE_NAMESPACE} with tag ${IMAGE_TAG}"

docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose -f "$COMPOSE_FILE" ps

echo "Waiting for public endpoint..."
for attempt in {1..12}; do
  if curl -fsS --max-time 10 "https://${DOMAIN:-playblockopoly.com}/" >/dev/null; then
    echo "Public endpoint is healthy."
    exit 0
  fi
  echo "Health check attempt ${attempt}/12 failed; retrying..."
  sleep 5
done

echo "Deployment finished, but public endpoint health check failed." >&2
exit 1
