import { useEffect, useState } from "react";
import { useNectarineRadio } from "@/hooks/useNectarineRadio";
import { soundManager } from "@/utils/sounds";

interface MusicInfoRowProps {
  musicSource: "radio" | "builtin";
  /** Bonus-letter hint text; when set it takes over the row */
  hintText?: string | null;
}

/**
 * Fixed 18px, never-scrolling info row below the play area.
 * Priority: bonus-letter hint > radio now-playing > built-in track name.
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

  let content: React.ReactNode = null;

  if (hintText) {
    content = (
      <span
        style={{
          color: "hsl(48, 100%, 60%)",
          textShadow: "0 0 10px hsl(48, 100%, 60%), 0 0 20px hsl(48, 100%, 50%)",
        }}
      >
        {hintText}
      </span>
    );
  } else if (isRadio) {
    if (nowPlaying) {
      content = (
        <>
          <span style={{ color: "hsl(48, 100%, 60%)" }}>
            {`♪ ${nowPlaying.artist} — ${nowPlaying.title}`}
          </span>
          {rating && (
            <span style={{ color: "hsl(160, 80%, 55%)" }}>
              {`   ★${rating.rating.toFixed(2)} (${rating.votes})`}
            </span>
          )}
          {timeLeft && timeLeft !== "-" && (
            <span style={{ color: "hsl(200, 90%, 65%)" }}>{`   ·   ${timeLeft} LEFT`}</span>
          )}
        </>
      );
    }
  } else if (trackName) {
    content = <span style={{ color: "hsl(48, 100%, 60%)" }}>{`♪ ${trackName}`}</span>;
  }

  return (
    <div
      className="w-full flex items-center justify-center retro-pixel-text text-[10px] pointer-events-none"
      style={{
        height: "18px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      aria-hidden="true"
    >
      <span
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
          opacity: content ? 1 : 0,
          transition: "opacity 300ms ease",
        }}
      >
        {content}
      </span>
    </div>
  );
}

export default MusicInfoRow;
