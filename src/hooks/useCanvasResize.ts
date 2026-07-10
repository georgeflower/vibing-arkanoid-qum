import { useEffect, useRef, useCallback, useState } from "react";

interface CanvasResizeOptions {
  enabled: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  gameGlowRef: React.RefObject<HTMLDivElement>;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
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
  canvasRef,
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
    const viewportWidth = window.innerWidth;
    const paddingOffset = viewportWidth >= 769 ? 16 : 0;
    const isTouchDevice = navigator.maxTouchPoints > 0;
    const visibleHeight = isTouchDevice
      ? Math.min(container.clientHeight, window.visualViewport?.height ?? container.clientHeight)
      : container.clientHeight;
    const availableWidth = Math.max(0, container.clientWidth - paddingOffset);
    const availableHeight = Math.max(0, visibleHeight - paddingOffset);

    if (availableWidth === 0 || availableHeight === 0) return;

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

    const finalDisplayWidth = Math.floor(displayWidth);
    const finalDisplayHeight = Math.floor(displayHeight);
    const scale = displayWidth / logicalWidth;

    setSize({
      displayWidth: finalDisplayWidth,
      displayHeight: finalDisplayHeight,
      scale,
    });

    // Apply size to game-glow container
    gameGlowRef.current.style.width = `${finalDisplayWidth}px`;
    gameGlowRef.current.style.height = `${finalDisplayHeight}px`;

    if (canvasRef?.current) {
      canvasRef.current.style.width = `${finalDisplayWidth}px`;
      canvasRef.current.style.height = `${finalDisplayHeight}px`;
    }
  }, [canvasRef, containerRef, gameGlowRef, logicalWidth, logicalHeight]);

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

  useEffect(() => {
    if (!enabled) return;

    const vv = window.visualViewport;
    if (!vv) return;

    vv.addEventListener("resize", debouncedCalculate);
    vv.addEventListener("scroll", debouncedCalculate);

    return () => {
      vv.removeEventListener("resize", debouncedCalculate);
      vv.removeEventListener("scroll", debouncedCalculate);
    };
  }, [debouncedCalculate, enabled]);

  return size;
}
