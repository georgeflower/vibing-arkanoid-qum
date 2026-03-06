// ═══════════════════════════════════════════════════════════════
// ████████╗ DEBUG CONFIGURATION - SET TO FALSE FOR PRODUCTION ████████╗
// ═══════════════════════════════════════════════════════════════
export const ENABLE_DEBUG_FEATURES = false;
// ═══════════════════════════════════════════════════════════════

export const CANVAS_WIDTH = 850;
export const CANVAS_HEIGHT = 650;
export const PADDLE_WIDTH = 110;
export const PADDLE_HEIGHT = 14;
export const BALL_RADIUS = 6;
export const BRICK_ROWS = 14;
export const BRICK_COLS = 13;
export const BRICK_WIDTH = 56;
export const BRICK_HEIGHT = 21;
export const BRICK_PADDING = 4;
export const BRICK_OFFSET_TOP = 90;
export const BRICK_OFFSET_LEFT = (CANVAS_WIDTH - (BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_PADDING)) / 2;

export const POWERUP_SIZE = 61; // Same as brick width
export const POWERUP_FALL_SPEED = 2;
export const POWERUP_DROP_CHANCE = 0.2; // 20%
export const FIREBALL_DURATION = 5000; // 5 seconds

// Final level - game ends after this level
export const FINAL_LEVEL = 20;

export const BULLET_WIDTH = 4;
export const BULLET_HEIGHT = 12;
export const BULLET_SPEED = 7;

// Color palettes that change every 5 levels
export const colorPalettes = [
  // Palette 1: Classic Amiga (levels 1-5)
  [
    "hsl(0, 75%, 55%)", // red
    "hsl(30, 85%, 55%)", // orange
    "hsl(45, 90%, 55%)", // yellow
    "hsl(200, 70%, 50%)", // blue
    "hsl(280, 60%, 55%)", // purple
    "hsl(330, 70%, 55%)", // pink
    "hsl(120, 60%, 45%)", // green
    "hsl(180, 65%, 50%)", // cyan
  ],
  // Palette 2: Hot Metal (levels 6-10)
  [
    "hsl(15, 90%, 60%)", // bright red-orange
    "hsl(350, 85%, 55%)", // crimson
    "hsl(40, 95%, 60%)", // gold
    "hsl(25, 90%, 50%)", // rust
    "hsl(0, 85%, 45%)", // deep red
    "hsl(35, 90%, 55%)", // amber
    "hsl(10, 80%, 50%)", // burnt orange
    "hsl(45, 85%, 50%)", // bronze
  ],
  // Palette 3: Neon City (levels 11-15)
  [
    "hsl(300, 90%, 60%)", // magenta
    "hsl(180, 85%, 55%)", // cyan
    "hsl(280, 90%, 65%)", // electric purple
    "hsl(190, 85%, 60%)", // bright cyan
    "hsl(320, 85%, 60%)", // hot pink
    "hsl(170, 80%, 55%)", // turquoise
    "hsl(290, 85%, 55%)", // violet
    "hsl(200, 90%, 60%)", // sky blue
  ],
  // Palette 4: Jungle (levels 16-20)
  [
    "hsl(120, 70%, 50%)", // green
    "hsl(90, 75%, 45%)", // lime
    "hsl(150, 65%, 45%)", // emerald
    "hsl(60, 80%, 50%)", // yellow-green
    "hsl(140, 70%, 40%)", // forest
    "hsl(75, 70%, 45%)", // chartreuse
    "hsl(160, 60%, 45%)", // sea green
    "hsl(100, 65%, 50%)", // grass
  ],
];

export const getBrickColors = (level: number): string[] => {
  const paletteIndex = Math.floor((level - 1) / 5) % colorPalettes.length;
  return colorPalettes[paletteIndex];
};

// Colors for multi-hit bricks (darker shades as hits decrease)
export const getHitColor = (baseColor: string, hitsRemaining: number, maxHits: number): string => {
  if (hitsRemaining === maxHits) return baseColor;
  const lightnessReduction = ((maxHits - hitsRemaining) / maxHits) * 20;
  const match = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (match) {
    const [, h, s, l] = match;
    return `hsl(${h}, ${s}%, ${Math.max(20, parseInt(l) - lightnessReduction)}%)`;
  }
  return baseColor;
};

// Physics & Collision Constants
export const PHYSICS_CONFIG = {
  MAX_SUBSTEPS: 20,
  MIN_SUBSTEPS: 2,
  SUBSTEP_FACTOR: 0.15, // Ball speed / (brick dimension * factor)
  CCD_EPSILON_MIN: 0.5,
  CCD_EPSILON_FACTOR: 0.1, // * ball.radius
  PADDLE_CORNER_RADIUS: 5,
  PADDLE_SAFETY_MARGIN: 2,
  BOSS_HITBOX_EXPAND: 1,
  BOSS_SAFETY_MARGIN: 2,
  PADDLE_HIT_COOLDOWN_MS: 50, // ~3 ticks at 60Hz
  EPS_TOI: 0.01, // Tolerance for duplicate collision events
} as const;

// Boss-exclusive power-up durations
export const BOSS_STUNNER_DURATION = 5000; // 5 seconds
export const REFLECT_SHIELD_DURATION = 15000; // 15 seconds
export const HOMING_BALL_DURATION = 8000; // 8 seconds

// Homing ball physics
export const HOMING_STRENGTH = 0.15; // How strongly ball curves toward boss
export const HOMING_MAX_TURN = 0.1; // Maximum turn rate per frame (radians)

// Set to true to re-enable high quality rendering (glow, extra shadows)
export const ENABLE_HIGH_QUALITY = true;
