import { useEffect, useState, useRef } from "react";

interface GetReadyOverlayProps {
  ballPosition: { x: number; y: number } | null;
  canvasWidth: number;
  canvasHeight: number;
  onComplete: () => void;
  isMobile?: boolean;
}

export const GetReadyOverlay = ({
  ballPosition,
  canvasWidth,
  canvasHeight,
  onComplete,
  isMobile = false,
}: GetReadyOverlayProps) => {
  const [scale, setScale] = useState(0.5);
  const [opacity, setOpacity] = useState(0);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Measure container size on mount and resize
  useEffect(() => {
    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    measureContainer();
    window.addEventListener("resize", measureContainer);
    return () => window.removeEventListener("resize", measureContainer);
  }, []);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setScale(1);
      setOpacity(1);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Progress animation over 3 seconds
  useEffect(() => {
    const startTime = Date.now();
    const duration = 3000;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(elapsed / duration, 1);
      setProgress(newProgress);

      if (newProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Fade out then complete
        setOpacity(0);
        setScale(1.2);
        setTimeout(onComplete, 300);
      }
    };

    requestAnimationFrame(animate);
  }, [onComplete]);

  // Scale ball position from canvas coordinates to container coordinates (desktop only)
  const scaleX = containerSize.width > 0 ? containerSize.width / canvasWidth : 1;
  const scaleY = containerSize.height > 0 ? containerSize.height / canvasHeight : 1;
  const ringX = ballPosition ? ballPosition.x * scaleX : 0;
  const ringY = ballPosition ? ballPosition.y * scaleY : 0;

  // Text position above the ball (desktop only)
  const textY = ringY - 60 * scaleY;

  // Ring size - also scale based on container (desktop only)
  const ringRadius = (30 + progress * 20) * Math.min(scaleX, scaleY);

  if (!ballPosition) return null;

  // Mobile version: centered text only, no ring
  if (isMobile) {
    return (
      <div 
        ref={containerRef}
        className="absolute inset-0 z-[150] pointer-events-none flex items-center justify-center"
        style={{
          opacity,
          transition: 'opacity 0.3s ease-out',
        }}
      >
        <div
          className="retro-pixel-text"
          style={{
            transform: `scale(${scale})`,
            transition: 'transform 0.3s ease-out',
            fontSize: '32px',
            color: 'hsl(48, 100%, 60%)',
            textShadow: `
              0 0 10px hsl(48, 100%, 60%),
              0 0 20px hsl(48, 100%, 50%),
              0 0 30px hsl(48, 100%, 40%),
              0 0 40px hsl(48, 100%, 30%)
            `,
            whiteSpace: 'nowrap',
          }}
        >
          GET READY!
        </div>
      </div>
    );
  }

  // Desktop version: glow effect (same as mobile) + floating text
  const glowSize = ringRadius * 3;
  
  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-[150] pointer-events-none"
      style={{
        opacity,
        transition: 'opacity 0.3s ease-out',
      }}
    >
      {/* Ball glow effect - same style as mobile */}
      <div
        className="absolute rounded-full"
        style={{
          left: ringX,
          top: ringY,
          width: glowSize,
          height: glowSize,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(100, 200, 255, 0.6) 0%, rgba(100, 200, 255, 0.3) 40%, transparent 70%)',
          boxShadow: `
            0 0 30px rgba(100, 200, 255, 0.8),
            0 0 60px rgba(100, 200, 255, 0.5),
            0 0 90px rgba(100, 200, 255, 0.3)
          `,
          animation: 'pulse 0.5s ease-in-out infinite',
        }}
      />

      {/* Floating text */}
      <div
        className="absolute retro-pixel-text"
        style={{
          left: ringX,
          top: textY,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transition: 'transform 0.3s ease-out',
          fontSize: `${24 * Math.min(scaleX, scaleY)}px`,
          color: 'hsl(48, 100%, 60%)',
          textShadow: `
            0 0 10px hsl(48, 100%, 60%),
            0 0 20px hsl(48, 100%, 50%),
            0 0 30px hsl(48, 100%, 40%)
          `,
          whiteSpace: 'nowrap',
        }}
      >
        GET READY!
      </div>
    </div>
  );
};
