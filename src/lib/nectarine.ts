// Client for the Nectarine / scenestream demovibes XML API via the xml-proxy edge function.
// Everything here fails silently: the game must never break or block on network issues.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROXY_URL = `${SUPABASE_URL}/functions/v1/xml-proxy`;
const FETCH_TIMEOUT_MS = 15_000;

export interface NowPlaying {
  artist: string;
  title: string;
  songId: string;
  lengthSec: number;
  playstart: string;
}

export interface OnelinerEntry {
  username: string;
  text: string;
  flag: string;
}

export async function fetchEndpoint(path: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${PROXY_URL}?path=${encodeURIComponent(path)}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Proxy error ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

export function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

function parseLength(raw: string | null): number {
  if (!raw) return 0;
  const v = raw.trim();
  if (v.includes(":")) {
    const parts = v.split(":").map((p) => parseInt(p, 10) || 0);
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

export function parseNowPlaying(doc: Document): NowPlaying | null {
  try {
    // CSS selectors on XML documents are unreliable across browsers - use tag traversal.
    const nowEl = doc.getElementsByTagName("now")[0];
    if (!nowEl) return null;
    const entry = nowEl.getElementsByTagName("entry")[0];
    if (!entry) return null;
    const artists = Array.from(entry.getElementsByTagName("artist"))
      .map((a) => (a.textContent ?? "").trim())
      .filter(Boolean);
    const songEl = entry.getElementsByTagName("song")[0];
    const title = (songEl?.textContent ?? "").trim();
    const songId = songEl?.getAttribute("id") ?? "";
    const lengthSec = parseLength(songEl?.getAttribute("length") ?? null);
    const playstart = (entry.getElementsByTagName("playstart")[0]?.textContent ?? "").trim();
    if (!title && artists.length === 0) return null;
    return { artist: artists.join(" & "), title, songId, lengthSec, playstart };
  } catch {
    return null;
  }
}

export function parseOneliners(doc: Document): OnelinerEntry[] {
  try {
    const entries = Array.from(doc.getElementsByTagName("entry")).slice(0, 8);
    return entries.map((entry) => {
      const authorEl =
        entry.getElementsByTagName("author")[0] ??
        entry.getElementsByTagName("user")[0] ??
        entry.getElementsByTagName("username")[0] ??
        entry.getElementsByTagName("nick")[0];
      const username = (authorEl?.textContent ?? "").trim() || "anon";
      const text = (
        entry.getElementsByTagName("message")[0]?.textContent ??
        entry.getElementsByTagName("text")[0]?.textContent ??
        ""
      ).trim();
      const flag = authorEl?.getAttribute("flag") ?? "";
      return { username, text, flag };
    });
  } catch {
    return [];
  }
}

export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2 || !/^[A-Za-z]{2}$/.test(code)) return "";
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    0x1f1e6 + (upper.charCodeAt(0) - 65),
    0x1f1e6 + (upper.charCodeAt(1) - 65),
  );
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function computeTimeLeft(playstart: string, lengthSec: number): string {
  if (!playstart || !lengthSec) return "-";
  const start = Date.parse(playstart);
  if (!Number.isFinite(start)) return "-";
  const remainingMs = start + lengthSec * 1000 - Date.now();
  return formatDuration(Math.max(0, remainingMs / 1000));
}

// ---- Song rating (cached) ----

interface RatingResult {
  rating: number;
  votes: number;
}

const RATING_TTL_MS = 30 * 60 * 1000;
const RATING_STORAGE_KEY = "necta-song-rating-v1";

const ratingMemCache = new Map<string, { value: RatingResult; ts: number }>();
const ratingInFlight = new Map<string, Promise<RatingResult | null>>();

function readRatingStore(): Record<string, { value: RatingResult; ts: number }> {
  try {
    const raw = localStorage.getItem(RATING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRatingStore(store: Record<string, { value: RatingResult; ts: number }>) {
  try {
    localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export async function songRating(songId: string): Promise<RatingResult | null> {
  if (!songId) return null;
  const now = Date.now();

  const mem = ratingMemCache.get(songId);
  if (mem && now - mem.ts < RATING_TTL_MS) return mem.value;

  const store = readRatingStore();
  const cached = store[songId];
  if (cached && now - cached.ts < RATING_TTL_MS) {
    ratingMemCache.set(songId, cached);
    return cached.value;
  }

  const existing = ratingInFlight.get(songId);
  if (existing) return existing;

  const request = (async (): Promise<RatingResult | null> => {
    try {
      const text = await fetchEndpoint(`song/${songId}`);
      const doc = parseXml(text);
      const ratingEl = doc.querySelector("rating");
      if (!ratingEl) return null;
      const rating = parseFloat((ratingEl.textContent ?? "").trim());
      const votes = parseInt(ratingEl.getAttribute("votes") ?? "0", 10);
      if (!Number.isFinite(rating)) return null;
      const value: RatingResult = { rating, votes: Number.isFinite(votes) ? votes : 0 };
      const ts = Date.now();
      ratingMemCache.set(songId, { value, ts });
      const s = readRatingStore();
      s[songId] = { value, ts };
      writeRatingStore(s);
      return value;
    } catch {
      return null;
    } finally {
      ratingInFlight.delete(songId);
    }
  })();

  ratingInFlight.set(songId, request);
  return request;
}
