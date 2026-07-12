// components/startbutton.tsx
import React, { useState } from "react";
import "./startbutton.css";

type Props = {
  onClick: () => void;
};

export const PrimaryButton: React.FC<Props> = ({ onClick }) => {
  const [explode, setExplode] = useState(false);

  const handleClick = () => {
    setExplode(true);
    setTimeout(() => setExplode(false), 1000);
    onClick();
  };

  return (
    <div className="button-container">
      <button
        className={`start-primary-button ${explode ? "explode" : ""}`}
        onClick={handleClick}
      >
        Click to Start
      </button>
      {explode &&
        Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`brick-piece piece-${i}`} />
        ))}
    </div>
  );
};
