import { useEffect, useState } from "react";

interface BossPowerUpTimerProps {
  label: string;
  endTime: number;
  duration: number;
  paddleX: number;
  paddleY: number;
  canvasWidth: number;
  isMobile?: boolean;
}

export const BossPowerUpTimer = ({
  label,
  endTime,
  duration,
  paddleX,
  paddleY,
  canvasWidth,
  isMobile = false,
}: BossPowerUpTimerProps) => {
  const [remaining, setRemaining] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timeLeft = Math.max(0, endTime - now);
      setRemaining(timeLeft);

      // Pulse animation - faster when time is low
      const progress = 1 - timeLeft / duration;
      const pulseSpeed = progress > 0.75 ? 8 : progress > 0.5 ? 4 : 2;
      const pulseIntensity = progress > 0.75 ? 0.15 : 0.08;
      const newScale = 1 + Math.sin(Date.now() * 0.01 * pulseSpeed) * pulseIntensity;
      setScale(newScale);
    }, 50);

    return () => clearInterval(interval);
  }, [endTime, duration]);

  if (remaining <= 0) return null;

  const progress = 1 - remaining / duration;
  
  // Color transition: yellow -> orange -> red
  let color: string;
  if (progress < 0.5) {
    // Yellow to orange
    const hue = 50 - progress * 40; // 50 to 30
    color = `hsl(${hue}, 100%, 50%)`;
  } else {
    // Orange to red
    const hue = 30 - (progress - 0.5) * 60; // 30 to 0
    color = `hsl(${Math.max(0, hue)}, 100%, 50%)`;
  }

  const seconds = (remaining / 1000).toFixed(1);

  // Position adjustments for mobile - closer to paddle, slightly left
  const leftPos = isMobile ? paddleX - 10 : paddleX + 50;
  const topPos = isMobile ? paddleY - 22 : paddleY - 35;
  const fontSize = isMobile ? "10px" : "14px";

  return (
    <div
      className="absolute pointer-events-none retro-pixel-text"
      style={{
        left: `${leftPos}px`,
        top: `${topPos}px`,
        transform: `scale(${scale})`,
        transformOrigin: "center bottom",
        color,
        textShadow: `0 0 10px ${color}, 0 0 20px ${color}`,
        fontSize,
        fontWeight: "bold",
        whiteSpace: "nowrap",
        zIndex: 100,
      }}
    >
      {label}: {seconds}s
    </div>
  );
};
