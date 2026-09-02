import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useNectarineRadio } from "@/hooks/useNectarineRadio";
import { countryCodeToFlag } from "@/lib/nectarine";
import { renderWithSmileys } from "@/lib/smileys";

interface RadioScrollerProps {
  /** Only fetches/renders content when the music source is the Nectarine radio */
  enabled: boolean;
  /** Potato quality: no animation, plain text smileys */
  potato?: boolean;
}

/** Scroll speed in pixels per second. */
const SPEED = 25;

/**
 * Always-rendered 18px marquee row below the play area showing the last 3
 * oneliners. The height is constant whether or not data has loaded so the
 * playfield can never shift. Pure CSS animation - no per-frame JS.
 */
export function RadioScroller({ enabled, potato = false }: RadioScrollerProps) {
  const { oneliners } = useNectarineRadio(enabled);
  const containerRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const pendingRef = useRef<number>(0);
  const [version, setVersion] = useState(0);
  const [metrics, setMetrics] = useState({ start: 0, end: 0, duration: 30 });

  const recent = oneliners.slice(0, 3);

  const parts: ReactNode[] = [];
  recent.forEach((o, i) => {
    if (i > 0) {
      parts.push(
        <span key={`ol-sep-${i}`} style={{ color: "hsl(0, 0%, 55%)" }}>
          {"   |   "}
        </span>,
      );
    }
    parts.push(
      <span key={`ol-user-${i}`} style={{ color: "hsl(300, 70%, 70%)" }}>
        {`${countryCodeToFlag(o.flag)} [${o.username}] `}
      </span>,
    );
    parts.push(
      <span key={`ol-msg-${i}`} style={{ color: "hsl(0, 0%, 85%)" }}>
        {renderWithSmileys(o.text, potato)}
      </span>,
    );
  });

  // Signature depends only on oneliner contents (never on time remaining).
  const signature = recent.map((o) => `${o.username}:${o.text}`).join("~");

  const displayedRef = useRef<{ sig: string; parts: ReactNode[] }>({ sig: "", parts: [] });
  const latestRef = useRef<{ sig: string; parts: ReactNode[] }>({ sig: "", parts: [] });
  latestRef.current = { sig: signature, parts };

  // First content shows immediately; later updates wait for animationiteration.
  if (displayedRef.current.sig === "" && signature.length > 0) {
    displayedRef.current = latestRef.current;
  } else if (displayedRef.current.sig !== signature) {
    pendingRef.current = 1;
  }

  const content = displayedRef.current.parts;

  useLayoutEffect(() => {
    const el = spanRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const spanWidth = el.scrollWidth;
    const containerWidth = container.clientWidth;
    const duration = Math.min(180, Math.max(15, (containerWidth + spanWidth) / SPEED));
    setMetrics({ start: containerWidth, end: -spanWidth, duration });
  }, [version, content.length, potato, enabled]);

  useEffect(() => {
    const el = spanRef.current;
    if (!el || potato) return;
    const onIteration = () => {
      if (pendingRef.current && latestRef.current.sig !== displayedRef.current.sig) {
        displayedRef.current = latestRef.current;
        pendingRef.current = 0;
        setVersion((v) => v + 1);
      }
    };
    el.addEventListener("animationiteration", onIteration);
    return () => el.removeEventListener("animationiteration", onIteration);
  }, [potato]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden pointer-events-none w-full"
      style={{ height: "18px" }}
      aria-hidden="true"
    >
      {enabled && content.length > 0 && (
        <span
          ref={spanRef}
          className="retro-pixel-text text-[10px] absolute left-0 top-0 whitespace-nowrap radio-marquee"
          style={
            potato
              ? ({ animation: "none", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties)
              : ({
                  animationDuration: `${metrics.duration}s`,
                  ["--marquee-start" as any]: `${metrics.start}px`,
                  ["--marquee-end" as any]: `${metrics.end}px`,
                } as React.CSSProperties)
          }
        >
          {content}
        </span>
      )}
    </div>
  );
}

export default RadioScroller;
