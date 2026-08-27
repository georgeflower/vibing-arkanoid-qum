/**
 * Unified, SSR-safe device detection — computed once at module load.
 *
 * Mobile rule (union of all prior call sites):
 *   UA matches Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini
 *   OR (ontouchstart present AND viewport ≤ 768 px)
 *
 * iOS rule (union of all prior call sites):
 *   UA matches iPhone|iPad|iPod
 *   OR (platform === "MacIntel" AND maxTouchPoints > 1)  — covers iPadOS
 */

const _ua =
  typeof navigator !== "undefined" ? navigator.userAgent : "";

export const isMobileDevice: boolean =
  typeof window !== "undefined"
    ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(_ua) ||
      ("ontouchstart" in window && window.matchMedia("(max-width: 768px)").matches)
    : false;

export const isIOSDevice: boolean =
  typeof navigator !== "undefined"
    ? /iPhone|iPad|iPod/i.test(_ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    : false;
