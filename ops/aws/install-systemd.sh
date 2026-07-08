#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_DIR="${INSTALL_DIR:-/opt/blockopoly}"
SERVICE_USER="${SERVICE_USER:-blockopoly}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo $0" >&2
  exit 1
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

mkdir -p "$INSTALL_DIR"
rsync -a --delete \
  --exclude ".git" \
  --exclude "frontend/node_modules" \
  --exclude ".playwright-mcp" \
  "$ROOT_DIR/" "$INSTALL_DIR/"

if [[ ! -f "$INSTALL_DIR/.env.release" ]]; then
  cp "$INSTALL_DIR/.env.release.example" "$INSTALL_DIR/.env.release"
  echo "Created $INSTALL_DIR/.env.release. Edit CERTBOT_EMAIL before issuing certificates."
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
chmod +x "$INSTALL_DIR"/ops/aws/*.sh

sed "s#__BLOCKOPOLY_ROOT__#$INSTALL_DIR#g" "$INSTALL_DIR/ops/aws/systemd/blockopoly-deploy.service" \
  >/etc/systemd/system/blockopoly-deploy.service
sed "s#__BLOCKOPOLY_ROOT__#$INSTALL_DIR#g" "$INSTALL_DIR/ops/aws/systemd/blockopoly-renew-cert.service" \
  >/etc/systemd/system/blockopoly-renew-cert.service
cp "$INSTALL_DIR/ops/aws/systemd/blockopoly-deploy.timer" /etc/systemd/system/blockopoly-deploy.timer
cp "$INSTALL_DIR/ops/aws/systemd/blockopoly-renew-cert.timer" /etc/systemd/system/blockopoly-renew-cert.timer

systemctl daemon-reload
systemctl enable blockopoly-deploy.timer blockopoly-renew-cert.timer

echo "Installed Blockopoly systemd timers."
echo "Next:"
echo "  1. Edit $INSTALL_DIR/.env.release"
echo "  2. Log in to GHCR if the package is private: docker login ghcr.io"
echo "  3. Run: sudo systemctl start blockopoly-deploy.service"
echo "  4. Run: sudo systemctl start blockopoly-renew-cert.service"
