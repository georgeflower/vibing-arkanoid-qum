import { useEffect, useRef, useState } from "react";
import { useNectarineRadio } from "@/hooks/useNectarineRadio";
import { formatOnelinerTime } from "@/lib/nectarine";
import { renderWithSmileys } from "@/lib/smileys";
import { isMobileDevice } from "@/utils/deviceDetect";

interface RadioChatProps {
  /** Only fetches/renders content when the music source is the Nectarine radio */
  enabled: boolean;
  /** Potato quality: no animation, plain text smileys */
  potato?: boolean;
}

interface ChatLine {
  key: string;
  time: string;
  username: string;
  text: string;
  fresh: boolean;
}

/**
 * Twitch-style chat block below the info row. Fixed height (2 lines mobile,
 * 3 lines desktop), newest message at the bottom. Only genuinely new entries
 * animate in.
 */
export function RadioChat({ enabled, potato = false }: RadioChatProps) {
  const { oneliners } = useNectarineRadio(enabled);
  const seenRef = useRef<Set<string>>(new Set());
  const [lines, setLines] = useState<ChatLine[]>([]);

  const maxLines = isMobileDevice ? 2 : 3;
  const height = isMobileDevice ? 28 : 42;

  useEffect(() => {
    if (!enabled || oneliners.length === 0) return;
    // API returns newest first; walk oldest -> newest so appends are ordered.
    const incoming = [...oneliners].reverse();
    const fresh: ChatLine[] = [];
    for (const o of incoming) {
      const key = `${o.time}|${o.username}|${o.text}`;
      if (seenRef.current.has(key)) continue;
      seenRef.current.add(key);
      fresh.push({ key, time: o.time, username: o.username, text: o.text, fresh: true });
    }
    if (fresh.length === 0) return;
    setLines((prev) => [...prev.map((l) => ({ ...l, fresh: false })), ...fresh].slice(-3));
  }, [oneliners, enabled]);

  const visible = lines.slice(-maxLines);

  return (
    <div
      className="w-full pointer-events-none overflow-hidden flex flex-col justify-end"
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      {enabled &&
        visible.map((l) => (
          <div
            key={l.key}
            className="retro-pixel-text text-[9px]"
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: "14px",
              animation: !potato && l.fresh ? "radio-chat-in 250ms ease-out" : undefined,
            }}
          >
            <span style={{ color: "hsl(0, 0%, 45%)" }}>{`[${formatOnelinerTime(l.time)}] `}</span>
            <span style={{ color: "hsl(300, 70%, 70%)" }}>{`${l.username}: `}</span>
            <span style={{ color: "hsl(0, 0%, 85%)" }}>{renderWithSmileys(l.text, potato)}</span>
          </div>
        ))}
    </div>
  );
}

export default RadioChat;
