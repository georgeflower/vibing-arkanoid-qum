/**
 * Turns a root-style public asset path ("/High_score.mp3") into a path relative to the
 * page ("./High_score.mp3"), so the game works from any folder (e.g. /games/q-arkanoid/)
 * and from /index.html directly. Full URLs, data: URLs and already-relative paths are
 * returned unchanged.
 */
export function assetUrl(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") ? `.${path}` : path;
}
