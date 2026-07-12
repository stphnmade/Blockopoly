import React from "react";
import FallingBricks from "../components/FallingBricks";
import logo from "../assets/Blockopoly-logo.svg";
import { PrimaryButton } from "../components/startbutton";
import clickSound from "../assets/click.mp3";
import "../style/StartScreen.css";

type Props = {
  onStart: () => void; // parent decides where to go
  onLearn?: () => void;
  onAbout?: () => void;
  onTutorial?: () => void;
};

export const StartScreen: React.FC<Props> = ({
  onStart,
  onLearn,
  onAbout,
  onTutorial,
}) => {
  const handleClick = () => {
    new Audio(clickSound).play();

    // delay lets brick-burst finish before leaving the page
    setTimeout(() => {
      onStart(); // 🔑 App will navigate("/main")
    }, 600);
  };

  return (
    <div className="start-screen">
      <div className="falling-bricks-wrapper">
        <FallingBricks />
      </div>

      <div className="div">
        <img className="blockopoly-logo" alt="Blockopoly logo" src={logo} />
        <PrimaryButton onClick={handleClick} />
        <button
          type="button"
          className="learn-button"
          onClick={() => onTutorial && onTutorial()}
        >
          Tutorial Room
        </button>
        <button
          type="button"
          className="learn-button"
          onClick={() => onLearn && onLearn()}
        >
          Learn How to Play
        </button>
        <button
          type="button"
          className="learn-button about-button"
          onClick={() => onAbout && onAbout()}
        >
          About & Downloads
        </button>
      </div>
    </div>
  );
};
