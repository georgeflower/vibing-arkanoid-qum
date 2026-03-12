/**
 * Daily Challenge Generation
 * Deterministic procedural layout + objective generation using date-based seeded RNG.
 * Features named shape templates, Saturday boss challenges, and challenge archive support.
 */

// ── Seeded RNG (mulberry32) ──────────────────────────────────
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Types ────────────────────────────────────────────────────
export interface DailyChallengeObjective {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export interface DailyChallengeModifier {
  id: string;
  label: string;
  description: string;
}

export interface DailyChallenge {
  layout: (boolean | number)[][];
  objectives: DailyChallengeObjective[];
  modifier: DailyChallengeModifier;
  seed: number;
  dateString: string;
  startingLives: number;
  targetScore: number;
  timeLimit: number; // seconds, 0 = no limit
  speedMultiplier: number;
  enemySpawnInterval: number;
  musicReactiveBackground: boolean;
  noExtraLives: boolean;
  shapeName: string;
  isBossChallenge: boolean;
  bossLevel: number;
}

// ── Named Shape Templates (14 rows × 13 cols) ───────────────
interface ShapeTemplate {
  name: string;
  icon: string;
  mask: number[][];
}

// Helper: 0 = empty, 1 = brick
const SHAPE_TEMPLATES: ShapeTemplate[] = [
  {
    name: "Heart",
    icon: "❤️",
    mask: [
      [0,0,1,1,0,0,0,0,1,1,0,0,0],
      [0,1,1,1,1,0,0,1,1,1,1,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Diamond",
    icon: "💎",
    mask: [
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Space Invader",
    icon: "👾",
    mask: [
      [0,0,0,1,0,0,0,0,0,1,0,0,0],
      [0,0,0,0,1,0,0,0,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,0,1,1,1,0,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,0,1,1,1,1,1,1,1,0,1,0],
      [0,1,0,1,0,0,0,0,0,1,0,1,0],
      [0,0,0,0,1,1,0,1,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "UFO",
    icon: "🛸",
    mask: [
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,0,0,1,0,1,0,0,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Flower",
    icon: "🌸",
    mask: [
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [0,1,1,1,0,0,1,0,0,1,1,1,0],
      [0,1,1,0,0,1,1,1,0,0,1,1,0],
      [0,1,1,0,0,1,1,1,0,0,1,1,0],
      [0,1,1,1,0,0,1,0,0,1,1,1,0],
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Skull",
    icon: "💀",
    mask: [
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,0,0,1,1,1,0,0,1,1,0],
      [0,1,1,0,0,1,1,1,0,0,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,0,1,0,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,0,1,0,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Star",
    icon: "⭐",
    mask: [
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [0,1,1,1,0,0,0,0,0,1,1,1,0],
      [1,1,1,0,0,0,0,0,0,0,1,1,1],
      [1,1,0,0,0,0,0,0,0,0,0,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Arrow",
    icon: "➡️",
    mask: [
      [0,0,0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,1,1,0,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,0,0],
      [1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,1,1,0,0,0,0],
      [0,0,0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Crown",
    icon: "👑",
    mask: [
      [0,1,0,0,0,1,0,1,0,0,0,1,0],
      [0,1,1,0,0,1,1,1,0,0,1,1,0],
      [0,1,1,0,0,1,1,1,0,0,1,1,0],
      [0,1,1,1,0,1,1,1,0,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Lightning",
    icon: "⚡",
    mask: [
      [0,0,0,0,0,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,0,0,0,0,0],
      [0,0,1,1,1,1,1,0,0,0,0,0,0],
      [0,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,1,1,1,0,0,0,0,0],
      [0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,1,1,1,1,0,0,0,0,0,0,0],
      [0,1,1,1,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Rocket",
    icon: "🚀",
    mask: [
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,0,1,1,1,1,1,0,1,1,0],
      [0,1,0,0,0,1,1,1,0,0,0,1,0],
      [1,0,0,0,0,0,1,0,0,0,0,0,1],
      [0,0,0,0,0,1,0,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Cat",
    icon: "🐱",
    mask: [
      [0,1,1,0,0,0,0,0,0,0,1,1,0],
      [0,1,1,1,0,0,0,0,0,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,0,0,1,1,1,1,1,0,0,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,1,1,0,1,0,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Butterfly",
    icon: "🦋",
    mask: [
      [0,1,1,0,0,0,0,0,0,0,1,1,0],
      [1,1,1,1,0,0,0,0,0,1,1,1,1],
      [1,1,1,1,1,0,0,0,1,1,1,1,1],
      [1,1,1,1,1,0,1,0,1,1,1,1,1],
      [1,1,1,1,0,0,1,0,0,1,1,1,1],
      [0,1,1,0,0,0,1,0,0,0,1,1,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [1,1,1,0,0,0,1,0,0,0,1,1,1],
      [1,1,1,1,0,0,1,0,0,1,1,1,1],
      [0,1,1,1,1,0,0,0,1,1,1,1,0],
      [0,0,1,1,0,0,0,0,0,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Mushroom",
    icon: "🍄",
    mask: [
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,0,0,1,1,1,0,0,1,1,0],
      [0,1,0,0,0,1,1,1,0,0,0,1,0],
      [1,1,0,0,0,1,1,1,0,0,0,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Sword",
    icon: "⚔️",
    mask: [
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,1,0,0,1,1,1,0,0,1,0,0],
      [0,0,0,1,0,1,1,1,0,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
    ],
  },
  {
    name: "Shield",
    icon: "🛡️",
    mask: [
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Ghost",
    icon: "👻",
    mask: [
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,0,0,1,1,1,0,0,1,1,0],
      [0,1,1,0,0,1,1,1,0,0,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,0,1,1,0,1,0,1,1,0,1,0],
      [0,0,0,0,1,0,0,0,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Pacman",
    icon: "🟡",
    mask: [
      [0,0,0,1,1,1,1,1,1,0,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0,0],
      [0,1,1,1,1,1,1,1,1,0,0,0,0],
      [1,1,1,1,1,1,1,1,0,0,0,0,0],
      [1,1,1,1,1,1,1,0,0,0,0,0,0],
      [1,1,1,1,1,1,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,1,0,0,0,0,0,0],
      [1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Crab",
    icon: "🦀",
    mask: [
      [0,1,0,0,0,0,0,0,0,0,0,1,0],
      [1,1,0,0,0,0,0,0,0,0,0,1,1],
      [1,0,0,1,1,1,1,1,1,1,0,0,1],
      [1,0,1,1,1,1,1,1,1,1,1,0,1],
      [0,0,1,0,0,1,1,1,0,0,1,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,0,1,0,0,0,1,0,1,0,0],
      [0,1,0,0,0,0,0,0,0,0,0,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Octopus",
    icon: "🐙",
    mask: [
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,1,0,0,1,1,1,0,0,1,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,0,1,0,1,0,1,0,1,0,0],
      [0,1,0,0,0,1,0,1,0,0,0,1,0],
      [1,0,0,0,0,0,0,0,0,0,0,0,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Tree",
    icon: "🌲",
    mask: [
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Castle",
    icon: "🏰",
    mask: [
      [1,0,1,0,0,0,0,0,0,0,1,0,1],
      [1,1,1,0,0,0,0,0,0,0,1,1,1],
      [1,1,1,0,0,0,1,0,0,0,1,1,1],
      [1,1,1,0,0,1,1,1,0,0,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,0,0,0,1,1,1,1,1],
      [1,1,1,1,1,0,0,0,1,1,1,1,1],
      [1,1,1,1,1,0,0,0,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Moon",
    icon: "🌙",
    mask: [
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,1,1,1,1,0,0,0,0,0,0,0],
      [0,1,1,1,1,0,0,0,0,0,0,0,0],
      [0,1,1,1,0,0,0,0,0,0,0,0,0],
      [0,1,1,1,0,0,0,0,0,0,0,0,0],
      [0,1,1,1,0,0,0,0,0,0,0,0,0],
      [0,1,1,1,0,0,0,0,0,0,0,0,0],
      [0,1,1,1,1,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Sun",
    icon: "☀️",
    mask: [
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,1,0,0,0,1,0,0,0,1,0,0],
      [0,0,0,1,0,0,1,0,0,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,0,0,1,0,0,1,0,0,0],
      [0,0,1,0,0,0,1,0,0,0,1,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Anchor",
    icon: "⚓",
    mask: [
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,0,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,1,0,0,0,0,1,0,0,0,0,1,0],
      [1,1,1,0,0,1,1,1,0,0,1,1,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,0,1,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Spiral",
    icon: "🌀",
    mask: [
      [0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,0,0,0,0,0,0,0,0,1,1,0],
      [1,0,0,1,1,1,1,1,1,0,0,1,0],
      [1,0,1,0,0,0,0,0,1,1,0,1,0],
      [1,0,1,0,1,1,1,0,0,1,0,1,0],
      [1,0,1,0,1,0,0,0,0,1,0,1,0],
      [1,0,1,0,1,1,1,1,1,1,0,1,0],
      [1,0,1,0,0,0,0,0,0,0,0,1,0],
      [1,0,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Bat",
    icon: "🦇",
    mask: [
      [1,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,0,0,0,0,0,0,0,0,0,1,1],
      [1,1,1,0,0,0,1,0,0,0,1,1,1],
      [1,1,1,1,0,1,1,1,0,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,1,1,1,1,1,1,1,1,1,0,1],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,0,0,0,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Robot",
    icon: "🤖",
    mask: [
      [0,0,0,0,0,0,1,0,0,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,1,0,0,0,0,0,1,0,0,0],
      [0,0,0,1,1,0,1,0,1,1,0,0,0],
      [0,0,0,1,0,0,0,0,0,1,0,0,0],
      [0,0,0,1,0,1,1,1,0,1,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,0,1,1,1,1,1,0,1,0,0],
      [0,0,1,0,1,1,1,1,1,0,1,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,1,0,1,1,0,0,0,0],
      [0,0,0,0,1,1,0,1,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
  {
    name: "Horse",
    icon: "🐴",
    mask: [
      [0,0,0,0,0,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,0,1,1,1,0,1,1,1,0,0,0],
      [0,0,0,1,1,0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,1,1,1,0,0,0,0,0,0],
      [0,0,0,1,1,0,1,1,0,0,0,0,0],
      [0,0,1,1,0,0,0,1,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
    ],
  },
];

// ── Objective pool ───────────────────────────────────────────
const OBJECTIVE_POOL: DailyChallengeObjective[] = [
  {
    id: "no_deaths",
    label: "No Deaths",
    description: "Complete without losing a life",
    icon: "❤️",
  },
  {
    id: "time_limit",
    label: "Speed Run",
    description: "Finish in under 3 minutes",
    icon: "⏱️",
  },
  {
    id: "destroy_all",
    label: "Total Destruction",
    description: "Destroy every brick",
    icon: "💥",
  },
  {
    id: "score_target",
    label: "Score Hunter",
    description: "Score at least {target} points",
    icon: "🎯",
  },
  {
    id: "no_powerups",
    label: "Purist",
    description: "Don't collect any power-ups",
    icon: "🚫",
  },
  {
    id: "combo_5",
    label: "Combo Master",
    description: "Achieve a 5+ hit combo",
    icon: "🔥",
  },
];

// ── Modifier pool ────────────────────────────────────────────
const MODIFIER_POOL: DailyChallengeModifier[] = [
  { id: "standard", label: "Standard", description: "No special modifiers" },
  { id: "one_life", label: "One Life", description: "Start with only 1 life" },
  { id: "two_lives", label: "Two Lives", description: "Start with 2 lives" },
  { id: "speed_up", label: "Fast Ball", description: "Ball moves 20% faster" },
  { id: "dense_bricks", label: "Brick Wall", description: "Extra dense brick layout" },
];

// ── Layout generation using shape templates ──────────────────
const ROWS = 14;
const COLS = 13;

function generateLayout(rng: () => number, modifier: DailyChallengeModifier, shape: ShapeTemplate): (boolean | number)[][] {
  const metalChance = 0.05 + rng() * 0.08;
  const explosiveChance = 0.03 + rng() * 0.05;
  const crackedChance = 0.04 + rng() * 0.06;

  const layout: (boolean | number)[][] = [];
  for (let row = 0; row < ROWS; row++) {
    const rowData: (boolean | number)[] = [];
    for (let col = 0; col < COLS; col++) {
      const shouldPlace = shape.mask[row]?.[col] === 1;

      if (!shouldPlace) {
        rowData.push(false);
        continue;
      }

      // Determine brick type
      const roll = rng();
      if (roll < metalChance) {
        rowData.push(2); // metal/indestructible
      } else if (roll < metalChance + explosiveChance) {
        rowData.push(3); // explosive
      } else if (roll < metalChance + explosiveChance + crackedChance) {
        rowData.push(4); // cracked
      } else {
        rowData.push(true); // normal
      }
    }
    layout.push(rowData);
  }

  // For dense_bricks modifier, fill in some extra bricks around the shape
  if (modifier.id === "dense_bricks") {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (layout[row][col] === false && rng() < 0.25) {
          // Check if adjacent to a shape brick
          const hasNeighbor = [
            [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1],
          ].some(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS && layout[r][c] !== false);
          if (hasNeighbor) {
            layout[row][col] = true;
          }
        }
      }
    }
  }

  return layout;
}

// ── Boss challenge types for Saturday ────────────────────────
const SATURDAY_BOSS_TYPES: Array<{ name: string; bossLevel: number; icon: string }> = [
  { name: "Cube", bossLevel: 5, icon: "🟦" },
  { name: "Sphere", bossLevel: 10, icon: "🟢" },
  { name: "Pyramid", bossLevel: 15, icon: "🔺" },
];

// ── Main generator ───────────────────────────────────────────
export function getDailyChallenge(date: Date = new Date()): DailyChallenge {
  const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const seed = hashString(`daily-challenge-v2-${dateString}`);
  const rng = mulberry32(seed);

  // Saturday = boss challenge (getDay() === 6)
  const isSaturday = date.getDay() === 6;

  if (isSaturday) {
    // Deterministically pick a boss type based on seed
    const bossIndex = Math.floor(rng() * SATURDAY_BOSS_TYPES.length);
    const bossType = SATURDAY_BOSS_TYPES[bossIndex];

    // Pick modifier (limited for boss)
    const modifierIndex = Math.floor(rng() * MODIFIER_POOL.length);
    const modifier = MODIFIER_POOL[modifierIndex];

    // Boss objectives
    const objectives: DailyChallengeObjective[] = [
      { id: "no_deaths", label: "No Deaths", description: "Defeat the boss without losing a life", icon: "❤️" },
      { id: "time_limit", label: "Speed Kill", description: "Defeat the boss in under 3 minutes", icon: "⏱️" },
    ];

    const startingLives = modifier.id === "one_life" ? 1 : modifier.id === "two_lives" ? 2 : 3;

    return {
      layout: [],
      objectives,
      modifier,
      seed,
      dateString,
      startingLives,
      targetScore: 5000,
      timeLimit: 180,
      speedMultiplier: 1.25,
      enemySpawnInterval: 7,
      musicReactiveBackground: true,
      noExtraLives: true,
      shapeName: `Saturday Boss: ${bossType.name}`,
      isBossChallenge: true,
      bossLevel: bossType.bossLevel,
    };
  }

  // Normal day — pick a shape
  const shapeIndex = Math.floor(rng() * SHAPE_TEMPLATES.length);
  const shape = SHAPE_TEMPLATES[shapeIndex];

  // Pick modifier
  const modifierIndex = Math.floor(rng() * MODIFIER_POOL.length);
  const modifier = MODIFIER_POOL[modifierIndex];

  // Pick 1 primary + 1 secondary objective (no duplicates)
  const primaryIndex = Math.floor(rng() * OBJECTIVE_POOL.length);
  let secondaryIndex = Math.floor(rng() * (OBJECTIVE_POOL.length - 1));
  if (secondaryIndex >= primaryIndex) secondaryIndex++;

  const objectives = [
    { ...OBJECTIVE_POOL[primaryIndex] },
    { ...OBJECTIVE_POOL[secondaryIndex] },
  ];

  // Generate target score (2000-8000, rounded to 500)
  const targetScore = Math.round((2000 + rng() * 6000) / 500) * 500;

  // Fill in score target description
  for (const obj of objectives) {
    if (obj.id === "score_target") {
      obj.description = `Score at least ${targetScore.toLocaleString()} points`;
    }
  }

  // Time limit for speed_run objective (150-210 seconds)
  let timeLimit = 0;
  if (objectives.some((o) => o.id === "time_limit")) {
    timeLimit = 150 + Math.floor(rng() * 60);
  }

  // Starting lives based on modifier
  const startingLives = modifier.id === "one_life" ? 1 : modifier.id === "two_lives" ? 2 : 3;

  // Generate layout using shape template
  const layout = generateLayout(rng, modifier, shape);

  return {
    layout,
    objectives,
    modifier,
    seed,
    dateString,
    startingLives,
    targetScore,
    timeLimit,
    speedMultiplier: 1.25,
    enemySpawnInterval: 7,
    musicReactiveBackground: true,
    noExtraLives: true,
    shapeName: shape.name,
    isBossChallenge: false,
    bossLevel: 0,
  };
}

// ── Objective evaluation ─────────────────────────────────────
export interface DailyChallengeResult {
  objectivesMet: string[];
  allObjectivesMet: boolean;
}

export function evaluateObjectives(
  challenge: DailyChallenge,
  stats: {
    livesLost: number;
    timeSeconds: number;
    allBricksDestroyed: boolean;
    score: number;
    powerUpsCollected: number;
    bestCombo: number;
  },
): DailyChallengeResult {
  const objectivesMet: string[] = [];

  for (const obj of challenge.objectives) {
    let met = false;
    switch (obj.id) {
      case "no_deaths":
        met = stats.livesLost === 0;
        break;
      case "time_limit":
        met = stats.timeSeconds <= (challenge.timeLimit || 180);
        break;
      case "destroy_all":
        met = stats.allBricksDestroyed;
        break;
      case "score_target":
        met = stats.score >= challenge.targetScore;
        break;
      case "no_powerups":
        met = stats.powerUpsCollected === 0;
        break;
      case "combo_5":
        met = stats.bestCombo >= 5;
        break;
    }
    if (met) objectivesMet.push(obj.id);
  }

  return {
    objectivesMet,
    allObjectivesMet: objectivesMet.length === challenge.objectives.length,
  };
}

/** Get today's date string in YYYY-MM-DD */
export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Get the shape icon for a given challenge */
export function getShapeIcon(shapeName: string): string {
  if (shapeName.startsWith("Saturday Boss:")) {
    const bossName = shapeName.replace("Saturday Boss: ", "");
    const boss = SATURDAY_BOSS_TYPES.find((b) => b.name === bossName);
    return boss?.icon || "👹";
  }
  const shape = SHAPE_TEMPLATES.find((s) => s.name === shapeName);
  return shape?.icon || "🎮";
}
