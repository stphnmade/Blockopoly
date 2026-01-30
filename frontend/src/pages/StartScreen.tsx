import React from "react";
import FallingBricks from "../components/FallingBricks";
import logo from "../assets/Blockopoly-logo.svg";
import { PrimaryButton } from "../components/startbutton";
import clickSound from "../assets/click.mp3";
import "../style/StartScreen.css";

type Props = {
  onStart: () => void; // parent decides where to go
  onLearn?: () => void;
};

export const StartScreen: React.FC<Props> = ({ onStart, onLearn }) => {
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
          onClick={() => onLearn && onLearn()}
        >
          Learn How to Play
        </button>
      </div>
    </div>
  );
};
