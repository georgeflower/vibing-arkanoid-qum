import { useEffect, useRef, useState } from "react";
import {
  fetchEndpoint,
  parseXml,
  parseNowPlaying,
  parseOneliners,
  computeTimeLeft,
  songRating,
  type NowPlaying,
  type OnelinerEntry,
} from "@/lib/nectarine";

interface Rating {
  rating: number;
  votes: number;
}

const POLL_MS = 30_000;

/**
 * Polls the Nectarine demovibes API for now-playing info and oneliners.
 * Everything fails silently: previous values are kept on any error.
 */
export function useNectarineRadio(enabled: boolean) {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [oneliners, setOneliners] = useState<OnelinerEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>("-");

  const nowPlayingRef = useRef<NowPlaying | null>(null);
  const lastSongIdRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const pollQueue = async () => {
      try {
        const doc = parseXml(await fetchEndpoint("queue"));
        const np = parseNowPlaying(doc);
        if (cancelled || !np) return;
        nowPlayingRef.current = np;
        setNowPlaying(np);
        if (np.songId && np.songId !== lastSongIdRef.current) {
          lastSongIdRef.current = np.songId;
          setRating(null);
          try {
            const r = await songRating(np.songId);
            if (!cancelled && r) setRating(r);
          } catch {
            /* silent */
          }
        }
      } catch {
        /* silent */
      }
    };

    const pollOneliner = async () => {
      try {
        const doc = parseXml(await fetchEndpoint("oneliner"));
        const list = parseOneliners(doc);
        if (!cancelled && list.length > 0) setOneliners(list);
      } catch {
        /* silent */
      }
    };

    pollQueue();
    pollOneliner();

    const qId = setInterval(pollQueue, POLL_MS);
    const oId = setInterval(pollOneliner, POLL_MS);
    const tId = setInterval(() => {
      const np = nowPlayingRef.current;
      setTimeLeft(np ? computeTimeLeft(np.playstart, np.lengthSec) : "-");
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(qId);
      clearInterval(oId);
      clearInterval(tId);
    };
  }, [enabled]);

  return { nowPlaying, rating, timeLeft, oneliners };
}
