import React, { useEffect, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 300 }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const distance = value - startValue;

    if (distance === 0) return;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Use easeOutQuart for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      
      setDisplayValue(Math.floor(startValue + distance * easeProgress));
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(value); // ensure final exact value
      }
    };
    window.requestAnimationFrame(step);
  }, [value, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{displayValue}</>;
};
