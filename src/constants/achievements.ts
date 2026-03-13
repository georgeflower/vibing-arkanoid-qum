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
  session_collected_all_letters?: boolean;
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
    id: "qumran_collector",
    name: "QUMRAN Collector",
    description: "Collect all Q-U-M-R-A-N letters in a single game",
    icon: "🔠",
    check: (p) => p.session_collected_all_letters === true,
  },
  {
    id: "godlike",
    name: "Godlike",
    description: "Beat level 20 on Godlike difficulty",
    icon: "👑",
    check: (p) => p.best_level >= 20 && p.session_difficulty === "godlike",
  },
  // Daily Challenge Achievements
  {
    id: "daily_warrior",
    name: "Daily Warrior",
    description: "Complete your first daily challenge",
    icon: "📅",
    check: () => false, // Server-side only
  },
  {
    id: "streak_3",
    name: "3-Day Streak",
    description: "Complete daily challenges 3 days in a row",
    icon: "🔥",
    check: () => false,
  },
  {
    id: "streak_7",
    name: "Weekly Warrior",
    description: "Complete daily challenges 7 days in a row",
    icon: "⚡",
    check: () => false,
  },
  {
    id: "streak_30",
    name: "Monthly Legend",
    description: "Complete daily challenges 30 days in a row",
    icon: "🏅",
    check: () => false,
  },
  {
    id: "daily_perfectionist",
    name: "Daily Perfectionist",
    description: "Complete all objectives in a daily challenge",
    icon: "💎",
    check: () => false,
  },
];
