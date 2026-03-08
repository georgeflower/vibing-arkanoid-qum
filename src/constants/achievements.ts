export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Check function receives the full profile stats and session stats */
  check: (profile: ProfileStats) => boolean;
}

export interface ProfileStats {
  total_bricks_destroyed: number;
  total_enemies_killed: number;
  total_bosses_killed: number;
  total_power_ups_collected: number;
  total_games_played: number;
  total_time_played_seconds: number;
  best_score: number;
  best_level: number;
  best_combo_streak: number;
  power_up_usage: Record<string, number>;
  // Session-specific (for single-game checks)
  session_score?: number;
  session_level?: number;
  session_difficulty?: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_blood",
    name: "First Blood",
    description: "Destroy your first brick",
    icon: "🧱",
    check: (p) => p.total_bricks_destroyed >= 1,
  },
  {
    id: "brick_breaker",
    name: "Brick Breaker",
    description: "Destroy 1,000 bricks total",
    icon: "💥",
    check: (p) => p.total_bricks_destroyed >= 1000,
  },
  {
    id: "demolition_expert",
    name: "Demolition Expert",
    description: "Destroy 10,000 bricks total",
    icon: "🏗️",
    check: (p) => p.total_bricks_destroyed >= 10000,
  },
  {
    id: "boss_slayer",
    name: "Boss Slayer",
    description: "Kill 10 bosses total",
    icon: "⚔️",
    check: (p) => p.total_bosses_killed >= 10,
  },
  {
    id: "marathon",
    name: "Marathon",
    description: "Play for 1 hour total",
    icon: "⏱️",
    check: (p) => p.total_time_played_seconds >= 3600,
  },
  {
    id: "high_roller",
    name: "High Roller",
    description: "Score 100,000 in a single game",
    icon: "💰",
    check: (p) => (p.session_score ?? p.best_score) >= 100000,
  },
  {
    id: "power_collector",
    name: "Power Collector",
    description: "Collect all 12 power-up types",
    icon: "🌟",
    check: (p) => Object.keys(p.power_up_usage).length >= 12,
  },
  {
    id: "perfect_combo",
    name: "Perfect Combo",
    description: "Achieve a hit streak of 10+",
    icon: "🔥",
    check: (p) => p.best_combo_streak >= 10,
  },
  {
    id: "victory_lap",
    name: "Victory Lap",
    description: "Beat level 20",
    icon: "🏆",
    check: (p) => p.best_level >= 20,
  },
  {
    id: "godlike",
    name: "Godlike",
    description: "Beat level 20 on Godlike difficulty",
    icon: "👑",
    check: (p) => p.best_level >= 20 && p.session_difficulty === "godlike",
  },
];
