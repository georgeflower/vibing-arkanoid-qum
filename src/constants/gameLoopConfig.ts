/**
 * Centralized game loop configuration constants.
 *
 * Adjust these values to tune game speed and timing behavior
 * without having to hunt down magic numbers across the codebase.
 */

/** Default game speed (1.0 = normal, 0.5 = half speed, 2.0 = double speed) */
export const DEFAULT_TIME_SCALE = 0.4;

/** Minimum allowed time scale (used by debug speed controls) */
export const MIN_TIME_SCALE = 0.1;

/** Maximum allowed time scale (used by debug speed controls) */
export const MAX_TIME_SCALE = 3.0;

/** FPS cap for high-end computers (frames per second) */
export const FPS_CAP = 120;

/** Maximum delta time in milliseconds (prevents large jumps after tab switches etc.) */
export const MAX_DELTA_MS = 250;
