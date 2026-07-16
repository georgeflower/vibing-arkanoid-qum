/**
 * engine/physicsLoop.ts — Standalone physics loop scheduler.
 * Owns the rAF chain + FPS cap. Game code registers a frame callback.
 * Mirrors renderLoop.ts so neither loop depends on React lifecycle.
 */
import { FPS_CAP } from "@/constants/gameLoopConfig";

let rafId: number | null = null;
let running = false;
let frameCallback: ((now: number) => void) | null = null;
let targetFps = FPS_CAP;
let minFrameTimeMs = 1000 / targetFps;
let lastTickTime = 0;

export function setPhysicsCallback(cb: (now: number) => void): void {
  frameCallback = cb;
}

export function setPhysicsTargetFps(fps: number): void {
  targetFps = Math.max(1, fps);
  minFrameTimeMs = 1000 / targetFps;
}

function tick(now: number): void {
  if (!running) return;
  rafId = requestAnimationFrame(tick);
  // FPS cap w/ drift compensation — matches prior in-loop pacing exactly.
  const elapsed = now - lastTickTime;
  if (elapsed < minFrameTimeMs) return;
  lastTickTime = now - (elapsed % minFrameTimeMs);
  frameCallback?.(now);
}

export function startPhysicsLoop(): void {
  if (running) return; // guard against double-start
  running = true;
  lastTickTime = 0;
  rafId = requestAnimationFrame(tick);
}

export function stopPhysicsLoop(): void {
  running = false;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function isPhysicsLoopRunning(): boolean {
  return running;
}
