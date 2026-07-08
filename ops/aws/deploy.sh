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

if [[ "${FULL_STACK_DEPLOY:-0}" == "1" ]]; then
  echo "Running full stack deploy."
  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
else
  echo "Running app-only deploy. Set FULL_STACK_DEPLOY=1 to also recreate Redis/Nginx."
  docker compose -f "$COMPOSE_FILE" up -d --no-deps frontend room-service game-service
  if docker compose -f "$COMPOSE_FILE" ps --services --filter status=running | grep -qx nginx; then
    docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload
  fi
fi

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
