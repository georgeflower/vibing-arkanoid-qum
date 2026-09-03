import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNectarineRadio } from "@/hooks/useNectarineRadio";
import { soundManager } from "@/utils/sounds";

interface MusicInfoRowProps {
  musicSource: "radio" | "builtin";
  /** Bonus-letter hint text; when set it takes over the row */
  hintText?: string | null;
}

/** Slow scroll speed (px/sec) for the left region when the text overflows. */
const SPEED = 15;

/**
 * Fixed 18px info row below the play area.
 * LEFT: now-playing / track name (scrolls slowly only when it overflows).
 * RIGHT: rating + time left (static, never scrolls).
 * A bonus-letter hint takes over the whole row.
 */
export function MusicInfoRow({ musicSource, hintText }: MusicInfoRowProps) {
  const isRadio = musicSource === "radio";
  const { nowPlaying, rating, timeLeft } = useNectarineRadio(isRadio);
  const [trackName, setTrackName] = useState(() => soundManager.getCurrentTrackName());

  useEffect(() => {
    const cb = () => setTrackName(soundManager.getCurrentTrackName());
    soundManager.onTrackChange(cb);
    cb();
    return () => soundManager.offTrackChange(cb);
  }, []);

  const leftText = isRadio
    ? nowPlaying
      ? `♪ ${nowPlaying.artist} — ${nowPlaying.title}`
      : ""
    : trackName
      ? `♪ ${trackName}`
      : "";

  const leftRegionRef = useRef<HTMLDivElement>(null);
  const leftTextRef = useRef<HTMLSpanElement>(null);
  const [marquee, setMarquee] = useState<{ start: number; end: number; duration: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const region = leftRegionRef.current;
      const el = leftTextRef.current;
      if (!region || !el || !leftText) {
        setMarquee(null);
        return;
      }
      const textWidth = el.scrollWidth;
      const regionWidth = region.clientWidth;
      if (textWidth <= regionWidth) {
        setMarquee(null);
        return;
      }
      const duration = Math.min(180, Math.max(15, (regionWidth + textWidth) / SPEED));
      setMarquee({ start: regionWidth, end: -textWidth, duration });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [leftText, hintText]);

  const rightParts: React.ReactNode[] = [];
  if (isRadio && !hintText) {
    if (rating) {
      rightParts.push(
        <span key="rating" style={{ color: "hsl(160, 80%, 55%)" }}>
          {`★${rating.rating.toFixed(2)} (${rating.votes})`}
        </span>,
      );
    }
    if (timeLeft && timeLeft !== "-") {
      rightParts.push(
        <span key="time" style={{ color: "hsl(200, 90%, 65%)" }}>
          {`${rightParts.length ? "   ·   " : ""}${timeLeft} LEFT`}
        </span>,
      );
    }
  }

  return (
    <div
      className="w-full flex items-center retro-pixel-text text-[10px] pointer-events-none"
      style={{ height: "18px", overflow: "hidden" }}
      aria-hidden="true"
    >
      {hintText ? (
        <div
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: "hsl(48, 100%, 60%)",
            textShadow: "0 0 10px hsl(48, 100%, 60%), 0 0 20px hsl(48, 100%, 50%)",
            transition: "opacity 300ms ease",
            opacity: 1,
          }}
        >
          {hintText}
        </div>
      ) : (
        <>
          <div
            ref={leftRegionRef}
            style={{ flex: 1, minWidth: 0, overflow: "hidden", position: "relative", height: "18px" }}
          >
            <span
              ref={leftTextRef}
              className={marquee ? "radio-marquee absolute left-0 top-0 whitespace-nowrap" : "whitespace-nowrap"}
              style={
                marquee
                  ? ({
                      color: "hsl(48, 100%, 60%)",
                      lineHeight: "18px",
                      animationDuration: `${marquee.duration}s`,
                      ["--marquee-start" as any]: `${marquee.start}px`,
                      ["--marquee-end" as any]: `${marquee.end}px`,
                      opacity: leftText ? 1 : 0,
                      transition: "opacity 300ms ease",
                    } as React.CSSProperties)
                  : ({
                      color: "hsl(48, 100%, 60%)",
                      display: "inline-block",
                      lineHeight: "18px",
                      opacity: leftText ? 1 : 0,
                      transition: "opacity 300ms ease",
                    } as React.CSSProperties)
              }
            >
              {leftText}
            </span>
          </div>
          <div
            style={{
              flex: "none",
              whiteSpace: "nowrap",
              paddingLeft: rightParts.length ? "8px" : 0,
              opacity: rightParts.length ? 1 : 0,
              transition: "opacity 300ms ease",
            }}
          >
            {rightParts}
          </div>
        </>
      )}
    </div>
  );
}

export default MusicInfoRow;
