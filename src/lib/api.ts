// Client for the Vibing Arkanoid Cloudflare Worker (leaderboards + radio proxy).
// Override with VITE_API_URL at build time if the Worker ever moves.

const DEFAULT_API_URL = "https://vibing-arkanoid-api.q-arkanoid.workers.dev";

export const API_BASE: string = (
  (import.meta.env.VITE_API_URL as string | undefined) || DEFAULT_API_URL
).replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Params = Record<string, string | number | undefined | null>;

function buildUrl(path: string, params?: Params): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const q = qs.toString();
  return `${API_BASE}${path}${q ? `?${q}` : ""}`;
}

async function parse<T>(resp: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await resp.json();
  } catch {
    // non-JSON body
  }
  if (!resp.ok) {
    const msg = (body as { error?: string } | null)?.error || `Request failed (${resp.status})`;
    throw new ApiError(resp.status, msg);
  }
  return body as T;
}

export async function apiGet<T>(path: string, params?: Params): Promise<T> {
  const resp = await fetch(buildUrl(path, params), { cache: "no-store" });
  return parse<T>(resp);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse<T>(resp);
}

/** Start of the local day / 7 days ago, as ISO strings (same rules the old queries used). */
export function dailySinceIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function weeklySinceIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

export interface ApiHighScoreRow {
  id: string;
  player_name: string;
  score: number;
  level: number;
  difficulty: string | null;
  beat_level_50: boolean;
  collected_all_letters: boolean;
  starting_lives: number;
  game_mode: string | null;
  created_at: string;
}

export function fetchHighScoreRows(
  period: "all-time" | "weekly" | "daily",
  difficulty: "all" | "normal" | "godlike",
): Promise<{ scores: ApiHighScoreRow[] }> {
  const since =
    period === "weekly" ? weeklySinceIso() : period === "daily" ? dailySinceIso() : undefined;
  return apiGet("/api/scores", { period, difficulty, since });
}
