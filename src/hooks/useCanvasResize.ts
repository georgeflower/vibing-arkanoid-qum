import { useEffect, useRef, useCallback, useState } from "react";

interface CanvasResizeOptions {
  enabled: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  gameGlowRef: React.RefObject<HTMLDivElement>;
  logicalWidth: number; // SCALED_CANVAS_WIDTH
  logicalHeight: number; // SCALED_CANVAS_HEIGHT
}

interface CanvasSize {
  displayWidth: number;
  displayHeight: number;
  scale: number;
}

/**
 * Hook that dynamically sizes the canvas container based on available space
 * using ResizeObserver. Maintains aspect ratio while maximizing display area.
 */
export function useCanvasResize({
  enabled,
  containerRef,
  gameGlowRef,
  logicalWidth,
  logicalHeight,
}: CanvasResizeOptions): CanvasSize {
  const [size, setSize] = useState<CanvasSize>({
    displayWidth: logicalWidth,
    displayHeight: logicalHeight,
    scale: 1,
  });

  const rafRef = useRef<number | null>(null);

  const calculateSize = useCallback(() => {
    if (!containerRef.current || !gameGlowRef.current) return;

    const container = containerRef.current;
    
    // Don't imperatively size on narrow viewports - let CSS handle it
    // This prevents conflicts when sidebars are hidden via CSS media queries
    const viewportWidth = window.innerWidth;
    if (viewportWidth < 769) {
      // Clear any previously set inline styles
      gameGlowRef.current.style.width = '';
      gameGlowRef.current.style.height = '';
      return;
    }

    const availableWidth = container.clientWidth - 16; // Account for padding
    const availableHeight = container.clientHeight - 16;

    // Calculate scale to fit while maintaining aspect ratio
    const aspectRatio = logicalWidth / logicalHeight;
    let displayWidth: number;
    let displayHeight: number;

    if (availableWidth / availableHeight > aspectRatio) {
      // Container is wider than canvas ratio - height-constrained
      displayHeight = availableHeight;
      displayWidth = displayHeight * aspectRatio;
    } else {
      // Container is taller than canvas ratio - width-constrained
      displayWidth = availableWidth;
      displayHeight = displayWidth / aspectRatio;
    }

    const scale = displayWidth / logicalWidth;

    setSize({
      displayWidth: Math.floor(displayWidth),
      displayHeight: Math.floor(displayHeight),
      scale,
    });

    // Apply size to game-glow container
    gameGlowRef.current.style.width = `${Math.floor(displayWidth)}px`;
    gameGlowRef.current.style.height = `${Math.floor(displayHeight)}px`;
  }, [containerRef, gameGlowRef, logicalWidth, logicalHeight]);

  const debouncedCalculate = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(calculateSize);
  }, [calculateSize]);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const observer = new ResizeObserver(debouncedCalculate);
    observer.observe(containerRef.current);

    // Also listen to window resize to detect viewport width changes
    // This handles the case where sidebars hide/show via CSS media queries
    const handleWindowResize = () => {
      debouncedCalculate();
    };
    window.addEventListener('resize', handleWindowResize);

    // Initial calculation
    calculateSize();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [enabled, containerRef, debouncedCalculate, calculateSize]);

  return size;
}
