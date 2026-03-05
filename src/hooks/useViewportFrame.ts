import { useEffect } from "react";

interface ViewportFrameOptions {
  enabled: boolean; // Gate for desktop-only behavior
  frameRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook that ensures the outer frame fills the viewport on desktop.
 * Adds the 'desktop-fullscreen' class to enable CSS-based viewport fill.
 */
export function useViewportFrame({ enabled, frameRef }: ViewportFrameOptions) {
  useEffect(() => {
    if (!enabled || !frameRef.current) return;

    // Add desktop-fullscreen class to enable CSS-based viewport fill
    frameRef.current.classList.add("desktop-fullscreen");

    return () => {
      frameRef.current?.classList.remove("desktop-fullscreen");
    };
  }, [enabled, frameRef]);
}
