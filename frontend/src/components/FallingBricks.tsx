import React, { useEffect, useState } from "react";
import "./FallingBricks.css";

const FallingBricks = () => {
  const [bricks, setBricks] = useState<React.ReactElement[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newBrick = (
        <div
          key={Date.now()}
          className="brick"
          style={{
            left: `${Math.random() * 100}vw`,
            animationDuration: `${Math.random() * 2 + 3}s`, // 3 to 5 second fall time
            backgroundColor: Math.random() > 0.5 ? "#d97706" : "#92400e",
          }}
        />
      );
      setBricks((prev) => [...prev.slice(-50), newBrick]); // limit brick count
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return <div className="falling-bricks-wrapper">{bricks}</div>;
};

export default FallingBricks;
