/**
 * Daily Challenge Generation
 * Deterministic procedural layout + objective generation using date-based seeded RNG.
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
}

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

// ── Layout generation ────────────────────────────────────────
const ROWS = 13;
const COLS = 13;

function generateLayout(rng: () => number, modifier: DailyChallengeModifier): (boolean | number)[][] {
  const density = modifier.id === "dense_bricks"
    ? 0.65 + rng() * 0.15  // 65-80%
    : 0.40 + rng() * 0.30; // 40-70%

  const metalChance = 0.05 + rng() * 0.08; // 5-13%
  const explosiveChance = 0.03 + rng() * 0.05; // 3-8%
  const crackedChance = 0.04 + rng() * 0.06; // 4-10%

  // Pick a pattern type for visual variety
  const patternType = Math.floor(rng() * 5);

  const layout: (boolean | number)[][] = [];
  for (let row = 0; row < ROWS; row++) {
    const rowData: (boolean | number)[] = [];
    for (let col = 0; col < COLS; col++) {
      let shouldPlace = rng() < density;

      // Apply pattern modifiers for visual interest
      switch (patternType) {
        case 0: // Diamond
          shouldPlace = shouldPlace && (Math.abs(row - 6) + Math.abs(col - 6)) <= 7;
          break;
        case 1: // Checkerboard bias
          if ((row + col) % 2 === 0) shouldPlace = shouldPlace || rng() < 0.3;
          break;
        case 2: // Horizontal stripes
          if (row % 3 === 2) shouldPlace = false;
          break;
        case 3: // Circle
          shouldPlace = shouldPlace && (Math.pow(row - 6, 2) + Math.pow(col - 6, 2)) <= 40;
          break;
        case 4: // Full random (no pattern)
          break;
      }

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

  return layout;
}

// ── Main generator ───────────────────────────────────────────
export function getDailyChallenge(date: Date = new Date()): DailyChallenge {
  const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const seed = hashString(`daily-challenge-${dateString}`);
  const rng = mulberry32(seed);

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
  let startingLives = 3;
  if (modifier.id === "one_life") startingLives = 1;
  else if (modifier.id === "two_lives") startingLives = 2;

  // Generate layout
  const layout = generateLayout(rng, modifier);

  return {
    layout,
    objectives,
    modifier,
    seed,
    dateString,
    startingLives,
    targetScore,
    timeLimit,
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
        met = stats.timeSeconds <= challenge.timeLimit;
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
