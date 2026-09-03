import { useEffect, useState } from "react";
import { useNectarineRadio } from "@/hooks/useNectarineRadio";
import { soundManager } from "@/utils/sounds";

interface MusicInfoRowProps {
  musicSource: "radio" | "builtin";
  /** Bonus-letter hint text; when set it takes over the block */
  hintText?: string | null;
}

const CLAMP_STYLE: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/**
 * Fixed 42px music info block below the play area.
 * RADIO: artist/title wraps over up to 2 lines + rating/time line.
 * BUILT-IN: current track name (up to 2 lines).
 * A bonus-letter hint takes over the whole block. Nothing scrolls.
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

  const titleText = isRadio
    ? nowPlaying
      ? `♪ ${nowPlaying.artist} — ${nowPlaying.title}`
      : ""
    : trackName
      ? `♪ ${trackName}`
      : "";

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
            className="text-[10px]"
            style={{
              ...CLAMP_STYLE,
              textAlign: "center",
              color: "hsl(48, 100%, 60%)",
              opacity: titleText ? 1 : 0,
              transition: "opacity 300ms ease",
            }}
          >
            {titleText}
          </div>
          {isRadio && (
            <div className="text-[9px]" style={{ whiteSpace: "nowrap" }}>
              {showRating && (
                <span style={{ color: "hsl(160, 80%, 55%)" }}>
                  {`★${rating!.rating.toFixed(2)} (${rating!.votes})`}
                </span>
              )}
              {showRating && showTime && <span>{`   ·   `}</span>}
              {showTime && (
                <span style={{ color: "hsl(200, 90%, 65%)" }}>{`${timeLeft} LEFT`}</span>
              )}
              {!showRating && !showTime && <span>&nbsp;</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MusicInfoRow;
