# Blockopoly

Blockopoly is an online card game based on Monopoly Deal.

## Play

The hosted web app is live at:

[https://playblockopoly.com](https://playblockopoly.com)

## Desktop Apps

Blockopoly also supports distributed desktop clients for macOS, Windows, and Linux. The desktop app connects to the hosted Blockopoly services at `playblockopoly.com`, so players do not need to run Redis, Nginx, or backend services locally.

Download installers from GitHub Releases:

[https://github.com/stphnmade/Blockopoly/releases](https://github.com/stphnmade/Blockopoly/releases)

Expected desktop release assets:

- macOS: `.dmg`
- Windows: `.exe`
- Linux: `.AppImage`

## Deployment

The hosted production stack runs on AWS with Docker Compose:

- `frontend`
- `room-service`
- `game-service`
- `redis`
- `nginx`

Deployment and certificate renewal notes are in [docs/distribution-and-deployment.md](docs/distribution-and-deployment.md).

## Authors

Stephen Syl-Akinwale  
Joel Valerio  
Bleu Sanchez  
Lukman Moyosore  
