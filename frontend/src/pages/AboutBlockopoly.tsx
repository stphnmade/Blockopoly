import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/Blockopoly-logo.svg";
import "../style/AboutBlockopoly.css";

const RELEASE_URL = "https://github.com/Saparta/Blockopoly/releases/latest";
const WEB_URL = "https://playblockopoly.com";

const downloads = [
  {
    platform: "macOS",
    format: "DMG or ZIP",
    detail: "For Apple laptops and desktops. Open the latest release and choose the macOS artifact.",
  },
  {
    platform: "Windows",
    format: "EXE installer",
    detail: "For Windows PCs. The current package target is an NSIS .exe installer.",
  },
  {
    platform: "Linux",
    format: "AppImage",
    detail: "For Linux desktops. Download, mark executable if needed, then run.",
  },
];

export const AboutBlockopoly: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="about-root">
      <header className="about-header">
        <button
          type="button"
          className="about-back-button"
          onClick={() => navigate("/")}
        >
          Back
        </button>
        <div className="about-header-title">About & Downloads</div>
      </header>

      <main className="about-panel">
        <section className="about-hero" aria-labelledby="about-title">
          <img className="about-logo" src={logo} alt="Blockopoly logo" />
          <div className="about-copy">
            <h1 id="about-title">Blockopoly</h1>
            <p>
              Blockopoly is a fast online card-board game inspired by Monopoly
              Deal. You can play directly in the browser or install the desktop
              client and connect to the same hosted game services.
            </p>
            <div className="about-actions">
              <a className="about-primary-link" href={WEB_URL}>
                Play Web
              </a>
              <a className="about-secondary-link" href={RELEASE_URL}>
                Download Apps
              </a>
            </div>
          </div>
        </section>

        <section className="about-section" aria-labelledby="service-title">
          <h2 id="service-title">How It Runs</h2>
          <div className="about-service-grid">
            <div className="about-service-item">
              <span className="about-service-label">Web</span>
              <p>
                The browser app is hosted at playblockopoly.com and talks to
                Blockopoly services through the same domain.
              </p>
            </div>
            <div className="about-service-item">
              <span className="about-service-label">Desktop</span>
              <p>
                The installed app is a packaged client. It does not run the game
                server locally; it connects to the hosted room and game APIs.
              </p>
            </div>
            <div className="about-service-item">
              <span className="about-service-label">Server</span>
              <p>
                Room, game, Redis, and Nginx services run on the hosted Docker
                stack. CI builds images and the server pulls released versions.
              </p>
            </div>
          </div>
        </section>

        <section className="about-section" aria-labelledby="download-title">
          <h2 id="download-title">Desktop Downloads</h2>
          <div className="about-download-grid">
            {downloads.map((item) => (
              <a
                key={item.platform}
                className="about-download-card"
                href={RELEASE_URL}
              >
                <span className="about-download-platform">{item.platform}</span>
                <span className="about-download-format">{item.format}</span>
                <span className="about-download-detail">{item.detail}</span>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
