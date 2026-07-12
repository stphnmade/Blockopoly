import React from "react";
import "./LoadingSplash.css";

type LoadingSplashProps = {
  label?: string;
  inline?: boolean;
};

export const LoadingSplash: React.FC<LoadingSplashProps> = ({
  label = "Loading Blockopoly",
  inline = false,
}) => (
  <div
    className={inline ? "loading-splash inline" : "loading-splash"}
    role="status"
    aria-live="polite"
  >
    <div className="loading-splash-mark">
      <img src="/favicon.ico" alt="Blockopoly logo" />
    </div>
    <div className="loading-splash-label">{label}</div>
  </div>
);
