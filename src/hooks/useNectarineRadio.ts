import { useEffect, useState } from "react";
import {
  fetchEndpoint,
  parseXml,
  parseNowPlaying,
  computeTimeLeft,
  songRating,
  type NowPlaying,
} from "@/lib/nectarine";

interface Rating {
  rating: number;
  votes: number;
}

export interface RadioState {
  nowPlaying: NowPlaying | null;
  rating: Rating | null;
  timeLeft: string;
}

const POLL_MS = 30_000;

// Module-level singleton store so multiple components share one polling loop.
let state: RadioState = { nowPlaying: null, rating: null, timeLeft: "-" };
const listeners = new Set<() => void>();
let subscribers = 0;
let timers: ReturnType<typeof setInterval>[] = [];
let lastSongId = "";

function setState(patch: Partial<RadioState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

async function pollQueue() {
  try {
    const doc = parseXml(await fetchEndpoint("queue"));
    const np = parseNowPlaying(doc);
    if (!np) return;
    setState({ nowPlaying: np });
    if (np.songId && np.songId !== lastSongId) {
      lastSongId = np.songId;
      setState({ rating: null });
      try {
        const r = await songRating(np.songId);
        if (r) setState({ rating: r });
      } catch {
        /* silent */
      }
    }
  } catch {
    /* silent */
  }
}

function startPolling() {
  pollQueue();
  timers = [
    setInterval(pollQueue, POLL_MS),
    setInterval(() => {
      const np = state.nowPlaying;
      setState({ timeLeft: np ? computeTimeLeft(np.playstart, np.lengthSec) : "-" });
    }, 5000),
  ];
}

function stopPolling() {
  timers.forEach(clearInterval);
  timers = [];
}

/**
 * Polls the Nectarine demovibes API for now-playing info.
 * Shared across all consumers; everything fails silently.
 */
export function useNectarineRadio(enabled: boolean): RadioState {
  const [snapshot, setSnapshot] = useState<RadioState>(state);

  useEffect(() => {
    if (!enabled) return;
    const listener = () => setSnapshot(state);
    listeners.add(listener);
    subscribers += 1;
    if (subscribers === 1) startPolling();
    setSnapshot(state);
    return () => {
      listeners.delete(listener);
      subscribers -= 1;
      if (subscribers === 0) stopPolling();
    };
  }, [enabled]);

  return snapshot;
}
