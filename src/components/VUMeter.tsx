import { useRef, useEffect, useState } from "react";
import { soundManager } from "@/utils/sounds";

const SEGMENT_COUNT = 12;

// Color zones: green 0-60%, yellow 60-80%, red 80-100%
function getSegmentColor(index: number, lit: boolean): string {
  if (!lit) return "hsl(210, 15%, 18%)"; // dark unlit
  const pct = (index + 1) / SEGMENT_COUNT;
  if (pct <= 0.6) return "hsl(120, 70%, 45%)";  // green
  if (pct <= 0.8) return "hsl(50, 85%, 50%)";   // yellow
  return "hsl(0, 75%, 50%)";                      // red
}

interface VUMeterProps {
  channel: "left" | "right";
}

export function VUMeter({ channel }: VUMeterProps) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let running = true;
    const poll = () => {
      if (!running) return;
      const raw = channel === "left"
        ? soundManager.getLeftLevel()
        : soundManager.getRightLevel();
      // Apply some scaling to make it more responsive
      setLevel(Math.min(1, raw * 2.5));
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [channel]);

  const litCount = Math.round(level * SEGMENT_COUNT);

  return (
    <div className="vu-meter-column">
      <div className="vu-meter-label">{channel === "left" ? "L" : "R"}</div>
      <div className="vu-meter-bar">
        {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
          const segIndex = SEGMENT_COUNT - 1 - i; // top = highest
          const isLit = segIndex < litCount;
          return (
            <div
              key={i}
              className="vu-meter-segment"
              style={{
                backgroundColor: getSegmentColor(segIndex, isLit),
                boxShadow: isLit
                  ? `0 0 4px ${getSegmentColor(segIndex, true)}`
                  : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
