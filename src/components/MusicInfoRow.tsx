import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNectarineRadio } from "@/hooks/useNectarineRadio";
import { soundManager } from "@/utils/sounds";

interface MusicInfoRowProps {
  musicSource: "radio" | "builtin";
  /** Bonus-letter hint text; when set it takes over the block */
  hintText?: string | null;
  /** Pause the title ping-pong scroll during active gameplay */
  paused?: boolean;
}

/** Scroll speed (px/sec) for the ping-pong title scroll. */
const SPEED = 15;

const ARTIST_COLOR = "hsl(200, 90%, 65%)";
const TITLE_COLOR = "hsl(48, 100%, 60%)";

const ROW_STYLE: React.CSSProperties = {
  height: "14px",
  lineHeight: "14px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  textAlign: "center",
  width: "100%",
};

/**
 * Fixed 42px music info block below the play area — three 14px rows:
 * artist / title / rating+time. Nothing wraps; a long radio title
 * scrolls back and forth (ping-pong) inside its row.
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

  const artistText = isRadio && nowPlaying ? `♪ ${nowPlaying.artist}` : "";
  const titleText = isRadio && nowPlaying ? nowPlaying.title : "";
  const builtinText = !isRadio && trackName ? `♪ ${trackName}` : "";

  // Ping-pong scroll measurement for the radio title row.
  const titleRegionRef = useRef<HTMLDivElement>(null);
  const titleSpanRef = useRef<HTMLSpanElement>(null);
  const [pingpong, setPingpong] = useState<{ shift: number; duration: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const region = titleRegionRef.current;
      const el = titleSpanRef.current;
      if (!region || !el || !titleText) {
        setPingpong(null);
        return;
      }
      const overflow = el.scrollWidth - region.clientWidth;
      if (overflow <= 0) {
        setPingpong(null);
        return;
      }
      const duration = Math.min(30, Math.max(4, overflow / SPEED));
      setPingpong({ shift: overflow, duration });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [titleText]);

  const showRating = isRadio && !!rating;
  const showTime = isRadio && !!timeLeft && timeLeft !== "-";

  return (
    <div
      className="w-full flex flex-col items-center justify-center retro-pixel-text pointer-events-none"
      style={{ height: "42px", overflow: "hidden", lineHeight: "14px" }}
      aria-hidden="true"
    >
      {hintText ? (
        <div
          className="text-[10px]"
          style={{
            textAlign: "center",
            color: TITLE_COLOR,
            textShadow: "0 0 10px hsl(48, 100%, 60%), 0 0 20px hsl(48, 100%, 50%)",
            transition: "opacity 300ms ease",
            opacity: 1,
          }}
        >
          {hintText}
        </div>
      ) : isRadio ? (
        <>
          {/* Row 1: artist (cyan) */}
          <div className="text-[10px]" style={{ ...ROW_STYLE, color: ARTIST_COLOR }}>
            {artistText || <>&nbsp;</>}
          </div>
          {/* Row 2: title (gold), ping-pong scroll when overflowing */}
          <div
            ref={titleRegionRef}
            className="text-[10px]"
            style={{ ...ROW_STYLE, position: "relative", textOverflow: "clip" }}
          >
            <span
              ref={titleSpanRef}
              className={pingpong ? "title-pingpong" : undefined}
              style={
                pingpong
                  ? ({
                      display: "inline-block",
                      whiteSpace: "nowrap",
                      color: TITLE_COLOR,
                      animationDuration: `${pingpong.duration}s`,
                      ["--title-shift" as any]: `${-pingpong.shift}px`,
                    } as React.CSSProperties)
                  : { display: "inline-block", whiteSpace: "nowrap", color: TITLE_COLOR }
              }
            >
              {titleText || <>&nbsp;</>}
            </span>
          </div>
          {/* Row 3: rating + time left */}
          <div className="text-[9px]" style={ROW_STYLE}>
            {showRating && (
              <span style={{ color: "hsl(160, 80%, 55%)" }}>
                {`★${rating!.rating.toFixed(2)} (${rating!.votes})`}
              </span>
            )}
            {showRating && showTime && <span>{`   ·   `}</span>}
            {showTime && <span style={{ color: ARTIST_COLOR }}>{`${timeLeft} LEFT`}</span>}
            {!showRating && !showTime && <>&nbsp;</>}
          </div>
        </>
      ) : (
        <>
          {/* Built-in: track name on row 1, rows 2-3 empty placeholders */}
          <div className="text-[10px]" style={{ ...ROW_STYLE, color: ARTIST_COLOR }}>
            {builtinText || <>&nbsp;</>}
          </div>
          <div className="text-[10px]" style={ROW_STYLE}>
            &nbsp;
          </div>
          <div className="text-[9px]" style={ROW_STYLE}>
            &nbsp;
          </div>
        </>
      )}
    </div>
  );
}

export default MusicInfoRow;
