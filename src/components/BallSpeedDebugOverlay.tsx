import { useState, useEffect, useRef } from "react";
import { world } from "@/engine/state";

interface BallSpeedEntry {
  id: number;
  speed: number;
  prevSpeed: number | null;
  droppedWithoutPowerUp: boolean;
}

interface BallSpeedDebugOverlayProps {
  visible?: boolean;
}

export const BallSpeedDebugOverlay = ({ visible = true }: BallSpeedDebugOverlayProps) => {
  const [entries, setEntries] = useState<BallSpeedEntry[]>([]);
  const prevSpeedsRef = useRef<Map<number, number>>(new Map());
  const slowdownActiveRef = useRef(false);

  // Track whether slowdown power-up is active by checking world state
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      const balls = world.balls;
      const prevSpeeds = prevSpeedsRef.current;

      // Check if any active power-up is a slowdown (speed multiplier < 1 indicates slowdown)
      // We detect slowdown by checking world.powerUps for recently collected slowdown
      // Simple heuristic: if ALL balls dropped speed simultaneously, it's likely a power-up
      let anySlowdownPowerUp = false;
      for (const pu of world.powerUps) {
        if (pu.type === "slowdown") {
          anySlowdownPowerUp = true;
          break;
        }
      }

      const newEntries: BallSpeedEntry[] = balls.map((ball) => {
        const prev = prevSpeeds.get(ball.id) ?? null;
        const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        const dropped = prev !== null && currentSpeed < prev - 0.001 && !slowdownActiveRef.current;

        if (dropped) {
          console.warn(
            `⚠️ [BALL SPEED DROP] Ball #${ball.id}: speed dropped from ${prev.toFixed(4)} to ${currentSpeed.toFixed(4)} (Δ${(currentSpeed - prev).toFixed(4)}) without slowdown power-up`
          );
        }

        prevSpeeds.set(ball.id, currentSpeed);

        return {
          id: ball.id,
          speed: currentSpeed,
          prevSpeed: prev,
          droppedWithoutPowerUp: dropped,
        };
      });

      // Clean up IDs no longer in game
      const activeIds = new Set(balls.map((b) => b.id));
      for (const id of prevSpeeds.keys()) {
        if (!activeIds.has(id)) prevSpeeds.delete(id);
      }

      slowdownActiveRef.current = anySlowdownPowerUp;
      setEntries(newEntries);
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-2 left-2 bg-black/80 text-white p-3 rounded-lg font-mono text-xs z-50 pointer-events-none select-none max-w-[220px]">
      <div className="font-bold text-primary mb-2">Ball Speed Monitor</div>
      {entries.length === 0 ? (
        <div className="text-muted-foreground">No balls</div>
      ) : (
        <div className="space-y-0.5">
          {entries.map((e) => (
            <div key={e.id} className="flex justify-between gap-3">
              <span className="text-muted-foreground">#{e.id}</span>
              <span className={e.droppedWithoutPowerUp ? "text-red-400 font-bold" : "text-green-400"}>
                {e.speed.toFixed(3)}
                {e.droppedWithoutPowerUp && " ▼"}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 pt-1 border-t border-border/20 text-[10px] text-muted-foreground">
        Red = speed drop without slowdown
      </div>
    </div>
  );
};
