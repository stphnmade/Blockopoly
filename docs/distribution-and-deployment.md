# Blockopoly Distribution And Deployment

Blockopoly should produce two release shapes from the same codebase:

1. A hosted web stack: browser client, room service, game service, Redis, and TLS reverse proxy.
2. A desktop client: Electron package distributed from GitHub that connects to the hosted services.

## Runtime Boundaries

- `frontend` is the client. The web build is served by Nginx. The desktop build is packaged by Electron.
- `room-service` owns lobby creation, joining, room state, and room lifecycle.
- `game-service` owns game WebSocket state.
- `redis` is shared backend state and pub/sub.
- `nginx` owns the public HTTP/TLS edge and routes `/api/room` and `/api/game`.

The desktop client should not run Redis or Kotlin services locally for normal users. It should connect to:

- `https://playblockopoly.com/api/room`
- `https://playblockopoly.com/api/game`

Those are now the packaged desktop defaults when the app is loaded from `file://`. Development builds still fall back to `localhost`.

Runtime overrides are available for testing:

```js
localStorage.setItem("BLOCKOPOLY_ROOM_SERVICE", "https://example.com/api/room");
localStorage.setItem("BLOCKOPOLY_GAME_SERVICE", "https://example.com/api/game");
```

## GitHub Outputs

The repository now has these workflows:

- `CI`: validates frontend TypeScript, frontend web build, and both Kotlin service builds.
- `Docker Images`: publishes GHCR images for the web stack.
- `Desktop Build`: packages Electron artifacts for macOS, Linux, and Windows on version tags or manual dispatch. Tagged builds also attach the installer files to the GitHub Release.

Desktop release assets are named with this pattern:

```text
Blockopoly-<version>-<os>-<arch>.<ext>
```

Expected formats:

- macOS: `.dmg` and `.zip`
- Windows: `.exe` installer
- Linux: `.AppImage`

## AWS Host Role

The t2 instance should become a runtime host, not the primary build machine.

Recommended flow:

1. GitHub Actions builds and publishes Docker images.
2. The AWS host pulls known image tags.
3. Docker Compose restarts the stack.
4. A systemd timer or cron renews certificates and reloads Nginx.

Use `docker-compose.release.yml` on the server once GHCR publishing is configured:

```bash
export IMAGE_NAMESPACE=your-github-owner
export IMAGE_TAG=main
docker compose -f docker-compose.release.yml pull
docker compose -f docker-compose.release.yml up -d
```

## Certificate Renewal

Current Nginx config is already compatible with HTTP-01 renewal because it serves:

```text
/.well-known/acme-challenge/
```

The missing operational piece is an automated renew command plus Nginx reload. On the AWS host, use a host-level timer or cron so it can reload the running Nginx container after renewal:

```bash
docker run --rm \
  -v "$PWD/nginx/certbot/www:/var/www/certbot" \
  -v "$PWD/nginx/certbot/conf:/etc/letsencrypt" \
  certbot/certbot renew --webroot -w /var/www/certbot

docker compose -f docker-compose.release.yml exec nginx nginx -s reload
```

Before the August certificate expiry, verify renewal with:

```bash
docker run --rm \
  -v "$PWD/nginx/certbot/www:/var/www/certbot" \
  -v "$PWD/nginx/certbot/conf:/etc/letsencrypt" \
  certbot/certbot renew --dry-run --webroot -w /var/www/certbot
```
