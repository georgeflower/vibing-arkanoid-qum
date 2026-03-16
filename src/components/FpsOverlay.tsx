import { useState, useEffect, useRef } from 'react';

interface FpsOverlayProps {
  visible: boolean;
}

export const FpsOverlay = ({ visible }: FpsOverlayProps) => {
  const [fps, setFps] = useState(60);
  const [deltaMs, setDeltaMs] = useState(16.7);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(performance.now());

  useEffect(() => {
    if (!visible) return;

    const tick = (now: number) => {
      // Delta from last frame
      const dt = now - lastFrameRef.current;
      lastFrameRef.current = now;

      frameCountRef.current++;
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 500) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setFps(currentFps);
        setDeltaMs(Math.round(dt * 10) / 10);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  const fpsColor = fps >= 55 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="fixed bottom-4 left-4 z-[9999] pointer-events-none font-mono text-xs bg-black/70 rounded px-2 py-1 select-none">
      <span className={fpsColor}>FPS: {fps}</span>
      <span className="text-gray-400 ml-2">Δt: {deltaMs.toFixed(1)}ms</span>
    </div>
  );
};
