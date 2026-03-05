/**
 * Centralized game loop configuration constants.
 *
 * Adjust these values to tune game speed and timing behavior
 * without having to hunt down magic numbers across the codebase.
 */

/** Default game speed (1.0 = normal, 0.5 = half speed, 2.0 = double speed) */
export const DEFAULT_TIME_SCALE = 0.85;

/** Minimum allowed time scale (used by debug speed controls) */
export const MIN_TIME_SCALE = 0.1;

/** Maximum allowed time scale (used by debug speed controls) */
export const MAX_TIME_SCALE = 3.0;

/** FPS cap for high-end computers (frames per second) */
export const FPS_CAP = 120;

/** Maximum delta time in milliseconds (prevents large jumps after tab switches etc.) */
export const MAX_DELTA_MS = 250;

/** Fixed physics timestep in seconds (60 FPS physics for consistent simulation) */
export const FIXED_PHYSICS_TIMESTEP = 1 / 60;

/** Maximum physics accumulator value in seconds (prevents spiral of death on lag spikes) */
export const MAX_ACCUMULATOR = 0.25;
