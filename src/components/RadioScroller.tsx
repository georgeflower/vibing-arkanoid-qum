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

/**
 * Always-rendered 18px marquee row below the play area. The height is constant
 * whether or not data has loaded so the playfield can never shift.
 * Scrolling is a pure CSS animation - no per-frame JS.
 */
export function RadioScroller({ enabled, potato = false }: RadioScrollerProps) {
  const { nowPlaying, rating, timeLeft, oneliners } = useNectarineRadio(enabled);
  const spanRef = useRef<HTMLSpanElement>(null);
  const pendingRef = useRef<number>(0);
  const [version, setVersion] = useState(0);
  const [duration, setDuration] = useState(40);

  // Build the current content signature; new data is buffered and only swapped
  // in when the scroll cycle completes.
  const parts: ReactNode[] = [];
  if (nowPlaying) {
    let head = `♪ ${nowPlaying.artist} — ${nowPlaying.title}`;
    parts.push(
      <span key="np" style={{ color: "hsl(48, 100%, 60%)" }}>
        {head}
      </span>,
    );
    if (rating) {
      parts.push(
        <span key="rating" style={{ color: "hsl(160, 80%, 55%)" }}>
          {`  ★${rating.rating.toFixed(2)} (${rating.votes})`}
        </span>,
      );
    }
    if (timeLeft && timeLeft !== "-") {
      parts.push(
        <span key="time" style={{ color: "hsl(200, 90%, 65%)" }}>
          {`  ·  ${timeLeft} LEFT`}
        </span>,
      );
    }
  }
  if (oneliners.length > 0) {
    if (parts.length > 0) {
      parts.push(
        <span key="sep" style={{ color: "hsl(0, 0%, 55%)" }}>
          {"   ///   "}
        </span>,
      );
    }
    oneliners.forEach((o, i) => {
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
  }

  const signature =
    (nowPlaying ? `${nowPlaying.songId}|${rating?.rating ?? ""}|${timeLeft}` : "") +
    "|" +
    oneliners.map((o) => `${o.username}:${o.text}`).join("~");

  const displayedRef = useRef<{ sig: string; parts: ReactNode[] }>({ sig: "", parts: [] });
  const latestRef = useRef<{ sig: string; parts: ReactNode[] }>({ sig: "", parts: [] });
  latestRef.current = { sig: signature, parts };

  // First content shows immediately; later updates wait for animationiteration.
  if (displayedRef.current.sig === "" && signature.replace(/\|/g, "").length > 0) {
    displayedRef.current = latestRef.current;
  } else if (displayedRef.current.sig !== signature) {
    pendingRef.current = 1;
  }

  const content = displayedRef.current.parts;

  useLayoutEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    const width = el.scrollWidth;
    const secs = Math.min(90, Math.max(20, width / 60));
    setDuration(secs);
  }, [version, content.length, potato]);

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
              ? { animation: "none", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }
              : { animationDuration: `${duration}s` }
          }
        >
          {content}
        </span>
      )}
    </div>
  );
}

export default RadioScroller;
