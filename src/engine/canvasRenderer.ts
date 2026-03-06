/**
 * engine/canvasRenderer.ts — Pure rendering function.
 *
 * Extracted from GameCanvas.tsx's useEffect. All entity data is read
 * from `world`, UI/config data from `renderState`, and pre-loaded
 * images from `assets`. `now` is captured once per frame by the caller.
 *
 * NO React dependency. NO per-frame allocations beyond canvas API internals.
 */

import type { GameWorld } from "@/engine/state";
import type { RenderState, AssetRefs } from "@/engine/renderState";
import type { Brick, BonusLetterType } from "@/types/game";
import { isMegaBoss, type MegaBoss } from "@/utils/megaBossUtils";
import { brickRenderer } from "@/utils/brickLayerCache";
import { particlePool } from "@/utils/particlePool";

// ─── Module-level animation state (previously useRef) ────────

let dashOffset = 0;
const _drawnPairs = new Set<number>(); // reusable – cleared each frame, zero allocs

// ─── Gradient Cache ──────────────────────────────────────────
// Avoids recreating identical CanvasGradient objects every frame.
// Gradients are defined at the origin and repositioned via ctx.translate().
// Cache is invalidated when the canvas context changes (resize / remount).

const gradientCache: Record<string, CanvasGradient> = {};
let cacheCtx: CanvasRenderingContext2D | null = null;

function ensureCacheCtx(ctx: CanvasRenderingContext2D): void {
  if (cacheCtx !== ctx) {
    for (const k in gradientCache) delete gradientCache[k];
    cacheCtx = ctx;
  }
}

function getCachedRadialGradient(
  ctx: CanvasRenderingContext2D,
  key: string,
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number,
  stops: [number, string][],
): CanvasGradient {
  ensureCacheCtx(ctx);
  if (!gradientCache[key]) {
    const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    gradientCache[key] = g;
  }
  return gradientCache[key];
}

function getCachedLinearGradient(
  ctx: CanvasRenderingContext2D,
  key: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: [number, string][],
): CanvasGradient {
  ensureCacheCtx(ctx);
  if (!gradientCache[key]) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    gradientCache[key] = g;
  }
  return gradientCache[key];
}

// ─── Helpers ─────────────────────────────────────────────────

function isImageValid(img: HTMLImageElement | null): img is HTMLImageElement {
  return !!(img && img.complete && img.naturalHeight !== 0);
}

function getBackgroundPattern(
  ctx: CanvasRenderingContext2D,
  key: string,
  img: HTMLImageElement | null,
  assets: AssetRefs,
): CanvasPattern | null {
  if (!isImageValid(img)) return null;
  if (!assets.patterns[key]) {
    assets.patterns[key] = ctx.createPattern(img, "repeat");
  }
  return assets.patterns[key];
}

// ─── Shape-Matched Shadow Helpers ────────────────────────────
// Light source: top-left corner. Shadows offset toward bottom-right.
// No ctx.shadowBlur — just shape fills for near-zero GPU cost.

function drawCircleShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number = 0.35) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawRectShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number = 0.35,
) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.fillRect(x, y, width, height);
}

function drawPolygonShadow(
  ctx: CanvasRenderingContext2D,
  points: number[][],
  offsetX: number,
  offsetY: number,
  alpha: number = 0.35,
) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(points[0][0] + offsetX, points[0][1] + offsetY);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0] + offsetX, points[i][1] + offsetY);
  }
  ctx.closePath();
  ctx.fill();
}

function drawProjectedFacesShadow(
  ctx: CanvasRenderingContext2D,
  projected: number[][],
  faces: { indices: number[] }[],
  offsetX: number,
  offsetY: number,
  alpha: number = 0.35,
) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  faces.forEach((face) => {
    ctx.beginPath();
    ctx.moveTo(projected[face.indices[0]][0] + offsetX, projected[face.indices[0]][1] + offsetY);
    for (let j = 1; j < face.indices.length; j++) {
      ctx.lineTo(projected[face.indices[j]][0] + offsetX, projected[face.indices[j]][1] + offsetY);
    }
    ctx.closePath();
    ctx.fill();
  });
}

function drawHexShadow(
  ctx: CanvasRenderingContext2D,
  radius: number,
  offsetX: number,
  offsetY: number,
  alpha: number = 0.35,
) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = Math.cos(angle) * radius + offsetX;
    const y = Math.sin(angle) * radius + offsetY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// ─── Main Render Function ────────────────────────────────────

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  world: GameWorld,
  rs: RenderState,
  assets: AssetRefs,
  now: number,
): void {
  const { width, height } = rs;
  const level = rs.level;
  const qualitySettings = rs.qualitySettings;
  const gameState = rs.gameState;

  // Shorthand world reads
  const {
    balls,
    paddle,
    bricks,
    enemies,
    bombs,
    explosions,
    powerUps,
    bonusLetters,
    boss,
    resurrectedBosses,
    bossAttacks,
    laserWarnings,
    superWarnings,
    shieldImpacts,
    bulletImpacts,
    dangerBalls,
    screenShake,
    backgroundFlash,
    highlightFlash,
    launchAngle,
  } = world;

  // Bullets come from world (no renderState race condition); powerUps now also from world
  const bullets = world.bullets;
  const collectedLetters = rs.collectedLetters;
  const bossIntroActive = rs.bossIntroActive;
  const tutorialHighlight = rs.tutorialHighlight;
  const debugEnabled = rs.debugEnabled;
  const isMobile = rs.isMobile;
  const getReadyGlow = rs.getReadyGlow;
  const secondChanceImpact = rs.secondChanceImpact;
  const ballReleaseHighlight = rs.ballReleaseHighlight;
  const SHOW_BOSS_HITBOX = debugEnabled;

  // ═══ Apply screen shake ═══
  ctx.save();
  if (screenShake > 0) {
    // Deterministic noise via sin/cos — no Math.random() in render hot-path
    const shakeX = Math.sin(now * 0.073) * screenShake;
    const shakeY = Math.cos(now * 0.097) * screenShake;
    ctx.translate(shakeX, shakeY);
  }

  // ═══ Clear canvas + background ═══
  ctx.fillStyle = "hsl(220, 25%, 12%)";
  ctx.fillRect(0, 0, width, height);

  // Draw background based on level
  let useFittedBackground = false;

  if (level === 5 && isImageValid(assets.bossLevel5Bg)) {
    ctx.drawImage(assets.bossLevel5Bg, 0, 0, width, height);
    useFittedBackground = true;
  } else if (level === 10 && isImageValid(assets.bossLevel10Bg)) {
    ctx.drawImage(assets.bossLevel10Bg, 0, 0, width, height);
    useFittedBackground = true;
  } else if (level === 15 && isImageValid(assets.bossLevel15Bg)) {
    ctx.drawImage(assets.bossLevel15Bg, 0, 0, width, height);
    useFittedBackground = true;
  } else if (level === 20 && isImageValid(assets.bossLevel20Bg)) {
    ctx.drawImage(assets.bossLevel20Bg, 0, 0, width, height);
    useFittedBackground = true;
  }

  // Music-reactive hue overlay (Phase 3 mega boss + hit streak x10+)
  if (world.backgroundHue > 0 && qualitySettings.level !== "low") {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = `hsla(${world.backgroundHue}, 80%, 50%, 0.25)`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  if (!useFittedBackground) {
    let bgImg: HTMLImageElement | null = null;
    let bgKey = "bg4";

    if (level >= 16 && level <= 19) {
      bgImg = assets.backgroundImage1620;
      bgKey = "bg1620";
    } else if (level >= 11 && level <= 14) {
      bgImg = assets.backgroundImage1114;
      bgKey = "bg1114";
    } else if (level >= 6 && level <= 9) {
      bgImg = assets.backgroundImage69;
      bgKey = "bg69";
    } else {
      bgImg = assets.backgroundImage4;
      bgKey = "bg4";
    }

    const pattern = getBackgroundPattern(ctx, bgKey, bgImg, assets);
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Dim background for levels 1-4
  //  if (level >= 1 && level <= 4) {
  //    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  //    ctx.fillRect(0, 0, width, height);

  if (!isMobile && qualitySettings.ambientFlickerEnabled) {
    const ambientFlicker = Math.sin(now / 500) * 0.03 + 0.03;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(100, 150, 200, ${ambientFlicker})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Highlight flash effect
  if (highlightFlash > 0 && level >= 1 && level <= 4 && qualitySettings.level !== "low") {
    ctx.save();
    const isGolden = highlightFlash > 1.2;
    const intensity = Math.min(highlightFlash, 1.0);

    // Use globalAlpha instead of expensive blend modes
    ctx.globalAlpha = intensity * 0.5;
    ctx.fillStyle = isGolden ? "rgba(255, 200, 100, 1)" : "rgba(100, 200, 255, 1)";
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = intensity * 0.4;
    ctx.fillStyle = isGolden ? "rgba(255, 220, 150, 1)" : "rgba(150, 220, 255, 1)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Background flash
  //  if (backgroundFlash > 0) {
  //    ctx.fillStyle = `rgba(255, 255, 255, ${backgroundFlash * 0.4})`;
  //    ctx.fillRect(0, 0, width, height);
  //  }

  // ═══ Draw bricks ═══
  if (brickRenderer.isReady()) {
    brickRenderer.updateCache(bricks, qualitySettings);
    brickRenderer.drawToCanvas(ctx);
  } else {
    bricks.forEach((brick) => {
      if (brick.visible) {
        // No shadowBlur needed
        ctx.fillStyle = brick.color;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
      }
    });
  }

  // ═══ Draw paddle ═══
  if (paddle) {
    const img = assets.paddleImage;
    ctx.save();
    if (isImageValid(img)) {
      if (qualitySettings.shadowsEnabled) {
        drawRectShadow(ctx, paddle.x + 4, paddle.y + 4, paddle.width, paddle.height);
      }
      ctx.drawImage(img, paddle.x, paddle.y, paddle.width, paddle.height);
    } else {
      if (qualitySettings.shadowsEnabled) {
        drawRectShadow(ctx, paddle.x + 4, paddle.y + 4, paddle.width, paddle.height);
      }
      ctx.fillStyle = "hsl(200, 70%, 50%)";
      ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height / 2);
    }
    ctx.restore();
  }

  // ═══ DANGER BALLS (retro flat-shaded) ═══
  if (dangerBalls && dangerBalls.length > 0) {
    dangerBalls.forEach((dangerBall) => {
      ctx.save();
      const isHoming = dangerBall.isReflected;
      // Hard alternation like angry enemy blink
      const isAltPhase = Math.floor(now / 150) % 2 === 0;

      // Flashing arrow indicator instead of dashed guide line
      if (!isHoming && paddle) {
        const arrowVisible = Math.floor(now / 200) % 2 === 0;
        if (arrowVisible) {
          ctx.save();
          const arrowX = dangerBall.x;
          const arrowY = dangerBall.y + dangerBall.radius + 12;
          ctx.fillStyle = "hsl(45, 100%, 55%)";
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY + 10);
          ctx.lineTo(arrowX - 6, arrowY);
          ctx.lineTo(arrowX + 6, arrowY);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "hsl(45, 100%, 75%)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Helper: draw octagon at (cx, cy) with radius r
      const drawOctagon = (cx: number, cy: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 - Math.PI / 8;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };

      if (qualitySettings.shadowsEnabled) {
        drawCircleShadow(ctx, dangerBall.x + 4, dangerBall.y + 4, dangerBall.radius);
      }

      // Outer octagon (darker)
      const outerHue = isHoming ? 120 : 0;
      const outerLight = isAltPhase ? 35 : 28;
      drawOctagon(dangerBall.x, dangerBall.y, dangerBall.radius);
      ctx.fillStyle = `hsl(${outerHue}, 80%, ${outerLight}%)`;
      ctx.fill();
      ctx.strokeStyle = isHoming ? "hsl(120, 90%, 70%)" : "hsl(0, 90%, 70%)";
      ctx.lineWidth = 3;
      ctx.lineJoin = "miter";
      ctx.stroke();

      // Inner octagon (lighter) -- stepped color band
      const innerLight = isAltPhase ? 55 : 45;
      drawOctagon(dangerBall.x, dangerBall.y, dangerBall.radius * 0.6);
      ctx.fillStyle = `hsl(${outerHue}, 85%, ${innerLight}%)`;
      ctx.fill();

      // Chunky pixel-cross (5 small rectangles forming a plus sign)
      const blockSize = Math.max(3, Math.floor(dangerBall.radius * 0.22));
      ctx.fillStyle = isAltPhase ? "#ffffff" : isHoming ? "hsl(120, 100%, 85%)" : "hsl(0, 100%, 85%)";
      const cx = dangerBall.x;
      const cy = dangerBall.y;
      ctx.fillRect(cx - blockSize / 2, cy - blockSize * 1.5, blockSize, blockSize * 3); // vertical bar
      ctx.fillRect(cx - blockSize * 1.5, cy - blockSize / 2, blockSize * 3, blockSize); // horizontal bar

      // Pulsing outer octagon ring
      const ringVisible = Math.floor(now / 200) % 2 === 0;
      if (ringVisible) {
        ctx.strokeStyle = isHoming ? "hsl(120, 80%, 60%)" : "hsl(0, 80%, 60%)";
        ctx.lineWidth = 2;
        ctx.lineJoin = "miter";
        drawOctagon(dangerBall.x, dangerBall.y, dangerBall.radius * 1.4);
        ctx.stroke();
      }

      // "CATCH!" text in monospace
      if (!isHoming) {
        const textFlash = Math.floor(now / 180) % 2 === 0;
        ctx.fillStyle = textFlash ? "hsl(50, 100%, 55%)" : "hsl(30, 100%, 50%)";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("CATCH!", dangerBall.x, dangerBall.y - dangerBall.radius - 8);
      }

      ctx.restore();
    });

    // Paddle highlight for incoming danger balls
    const incomingDangerBalls = dangerBalls.filter((b) => !b.isReflected);
    if (incomingDangerBalls.length > 0 && paddle) {
      ctx.save();
      const highlightOn = Math.floor(now / 150) % 2 === 0;
      ctx.strokeStyle = highlightOn ? "hsl(190, 100%, 55%)" : "hsl(190, 80%, 35%)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(paddle.x - 4, paddle.y - 4, paddle.width + 8, paddle.height + 8, 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ═══ Draw balls ═══
  const chaosLevel = Math.min(
    1,
    (bombs.length + bossAttacks.length + enemies.length + explosions.length + dangerBalls.length) / 10,
  );

  balls.forEach((ball) => {
    const ballColor = ball.isFireball ? "hsl(30, 85%, 55%)" : "hsl(0, 0%, 92%)";

    // Get Ready glow
    if (getReadyGlow && getReadyGlow.opacity > 0) {
      ctx.save();
      const glowRadius = ball.radius * 3;
      const opaBucket = Math.floor(getReadyGlow.opacity * 10);
      const glowGradient = getCachedRadialGradient(
        ctx, `getReadyGlow_${opaBucket}_${Math.round(ball.radius)}`,
        0, 0, ball.radius,
        0, 0, glowRadius,
        [
          [0, `rgba(100, 200, 255, ${getReadyGlow.opacity * 0.6})`],
          [0.5, `rgba(100, 200, 255, ${getReadyGlow.opacity * 0.3})`],
          [1, "rgba(100, 200, 255, 0)"],
        ],
      );
      ctx.translate(ball.x, ball.y);
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(100, 200, 255, ${getReadyGlow.opacity * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, ball.radius * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Ball release highlight
    if (ballReleaseHighlight && ballReleaseHighlight.active) {
      ctx.save();
      const elapsed = now - ballReleaseHighlight.startTime;
      const duration = 1500;
      const progress = Math.min(elapsed / duration, 1);
      const glowOpacity = 1 - progress;
      const pulsePhase = (now % 400) / 400;
      const pulseIntensity = 1 + Math.sin(pulsePhase * Math.PI * 2) * 0.3;

      const releaseGlowRadius = ball.radius * 4 * pulseIntensity;
      const opaBucket2 = Math.floor(glowOpacity * 10);
      const releaseGradient = getCachedRadialGradient(
        ctx, `releaseGlow_${opaBucket2}_${Math.round(ball.radius)}`,
        0, 0, ball.radius,
        0, 0, releaseGlowRadius,
        [
          [0, `rgba(255, 220, 100, ${glowOpacity * 0.8})`],
          [0.4, `rgba(100, 255, 255, ${glowOpacity * 0.5})`],
          [1, "rgba(100, 200, 255, 0)"],
        ],
      );
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.fillStyle = releaseGradient;
      ctx.beginPath();
      ctx.arc(0, 0, releaseGlowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = `rgba(255, 255, 100, ${glowOpacity * 0.9})`;
      ctx.lineWidth = 3;
      // shadowBlur removed — gradient fill handles the visual
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius * 2.5 * pulseIntensity, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(100, 255, 255, ${glowOpacity * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius * 3.5 * pulseIntensity, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (paddle) {
        ctx.save();
        ctx.strokeStyle = `rgba(100, 255, 200, ${glowOpacity * 0.7})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 6]);
        ctx.lineDashOffset = -now / 40;
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(paddle.x + paddle.width / 2, paddle.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    const visualRadius = ball.radius + 2;

    // Chaos-aware glow
    if (chaosLevel > 0.2 && !ball.isFireball && qualitySettings.chaosGlowEnabled) {
      ctx.save();
      const chaosPulse = 1 + Math.sin(now / 200) * 0.2;
      const chaosGlowRadius = visualRadius * (2 + chaosLevel * 2) * chaosPulse;
      const chaosGlowOpacity = (chaosLevel - 0.2) * 0.875;
      const opaBucket3 = Math.floor(chaosGlowOpacity * 10);
      const chaosGradient = getCachedRadialGradient(
        ctx, `chaosGlow_${opaBucket3}`,
        0, 0, visualRadius * 0.5,
        0, 0, chaosGlowRadius,
        [
          [0, `rgba(150, 230, 255, ${chaosGlowOpacity})`],
          [0.5, `rgba(100, 200, 255, ${chaosGlowOpacity * 0.5})`],
          [1, "rgba(80, 180, 255, 0)"],
        ],
      );
      ctx.translate(ball.x, ball.y);
      ctx.fillStyle = chaosGradient;
      ctx.beginPath();
      ctx.arc(0, 0, chaosGlowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Dark outline
    if (!ball.isFireball) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${0.5 + chaosLevel * 0.2})`;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, visualRadius + 2 + chaosLevel, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(ball.x, ball.y);

    const gradient = ball.isFireball
      ? getCachedRadialGradient(
          ctx,
          `ball_fire_${visualRadius}`,
          -visualRadius * 0.3,
          -visualRadius * 0.3,
          0,
          0,
          0,
          visualRadius,
          [
            [0, "rgba(255,255,255,0.9)"],
            [0.3, "hsl(30,85%,65%)"],
            [0.7, "hsl(30,85%,55%)"],
            [1, "hsl(30,85%,35%)"],
          ],
        )
      : getCachedRadialGradient(
          ctx,
          `ball_norm_${visualRadius}`,
          -visualRadius * 0.3,
          -visualRadius * 0.3,
          0,
          0,
          0,
          visualRadius,
          [
            [0, "rgba(255,255,255,1)"],
            [0.3, "hsl(0,0%,95%)"],
            [0.7, "hsl(0,0%,92%)"],
            [1, "hsl(0,0%,60%)"],
          ],
        );

    if (qualitySettings.shadowsEnabled) {
      drawCircleShadow(ctx, 4, 4, visualRadius);
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, visualRadius, 0, Math.PI * 2);
    ctx.fill();

    // Retro spinning pattern
    const ballRotation = ball.rotation || 0;
    if (!ball.isFireball) {
      // shadowBlur removed
      ctx.rotate((ballRotation * Math.PI) / 180);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      for (let i = -visualRadius; i < visualRadius; i += 4) {
        const lineWidth = Math.sqrt(visualRadius * visualRadius - i * i) * 2;
        ctx.fillRect(-lineWidth / 2, i, lineWidth, 2);
      }
    }

    ctx.restore();

    // Fireball trail
    if (ball.isFireball && qualitySettings.glowEnabled) {
      const trailLength = 8;
      const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
      if (speed > 0) {
        for (let i = trailLength; i >= 1; i--) {
          const trailX = ball.x - (ball.dx / speed) * ball.radius * i * 1.0;
          const trailY = ball.y - (ball.dy / speed) * ball.radius * i * 1.0;
          const trailOpacity = 0.5 * (1 - i / (trailLength + 1));
          const trailSize = ball.radius * (1 - i / (trailLength + 2));
          ctx.save();
          ctx.globalAlpha = trailOpacity;
          ctx.fillStyle = `hsl(${30 - i * 5}, 85%, ${55 - i * 5}%)`;
          ctx.beginPath();
          ctx.arc(trailX, trailY, trailSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.fillStyle = "hsla(30, 85%, 55%, 0.25)";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Homing ball trail
    if (ball.isHoming && boss) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(boss.x + boss.width / 2, boss.y + boss.height / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // shadowBlur removed — red circle is sufficient
      ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Launch indicator
    if (ball.waitingToLaunch) {
      const angle = (launchAngle * Math.PI) / 180;
      const lineLength = 100;
      const endX = ball.x + Math.sin(angle) * lineLength;
      const endY = ball.y - Math.cos(angle) * lineLength;
      dashOffset = (dashOffset + 1) % 20;
      // shadowBlur removed — dashed line is clearly visible
      ctx.strokeStyle = "hsl(0, 85%, 55%)";
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -dashOffset;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
  });

  // ═══ Draw power-ups ═══
  powerUps.forEach((powerUp) => {
    if (!powerUp.active) return;
    const img = assets.powerUpImages[powerUp.type];
    const size = powerUp.width;
    const isHighlighted = tutorialHighlight?.type === "power_up" && powerUps.indexOf(powerUp) === 0;
    const pulsePhase = (now % 1000) / 1000;
    const pulseScale = 1 + Math.sin(pulsePhase * Math.PI * 2) * 0.05;

    ctx.save();
    // Alternating dim for dual-choice power-ups (zero-allocation)
    if (powerUp.isDualChoice && powerUp.pairedWithId !== undefined) {
      const isFirst = powerUp.id! < powerUp.pairedWithId;
      const phase = Math.floor(now / 750) % 2;
      const dimmed = isFirst ? phase === 0 : phase === 1;
      if (dimmed) ctx.globalAlpha = 0.35;
    }
    ctx.translate(powerUp.x + size / 2, powerUp.y + size / 2);
    ctx.scale(pulseScale, pulseScale);
    ctx.translate(-size / 2, -size / 2);

    if (isHighlighted) {
      // Use bright stroke instead of shadowBlur for tutorial highlight
      ctx.strokeStyle = "rgba(0, 255, 255, 0.9)";
      ctx.lineWidth = 3;
    }

    // Metallic background
    const padding = 4;
    const rectX = -padding;
    const rectY = -padding;
    const rectWidth = size + padding * 2;
    const rectHeight = size + padding * 2;
    const radius = 6;

    const metalGradient = getCachedLinearGradient(ctx, `pu_metal_${size}`, rectX, rectY, rectX, rectY + rectHeight, [
      [0, "hsl(220,10%,65%)"],
      [0.3, "hsl(220,8%,50%)"],
      [0.5, "hsl(220,10%,60%)"],
      [0.7, "hsl(220,8%,45%)"],
      [1, "hsl(220,10%,35%)"],
    ]);

    ctx.beginPath();
    ctx.moveTo(rectX + radius, rectY);
    ctx.lineTo(rectX + rectWidth - radius, rectY);
    ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
    ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
    ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
    ctx.lineTo(rectX + radius, rectY + rectHeight);
    ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
    ctx.lineTo(rectX, rectY + radius);
    ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
    ctx.closePath();
    ctx.fillStyle = metalGradient;
    ctx.fill();

    ctx.strokeStyle = "hsla(220, 15%, 80%, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rivets
    const rivetRadius = 3;
    const rivetOffset = 6;
    const rivetPositions = [
      { x: rectX + rivetOffset, y: rectY + rivetOffset },
      { x: rectX + rectWidth - rivetOffset, y: rectY + rivetOffset },
      { x: rectX + rivetOffset, y: rectY + rectHeight - rivetOffset },
      { x: rectX + rectWidth - rivetOffset, y: rectY + rectHeight - rivetOffset },
    ];

    const rivetGrad = getCachedRadialGradient(ctx, "pu_rivet", -0.5, -0.5, 0, 0, 0, rivetRadius, [
      [0, "hsl(220,8%,70%)"],
      [0.4, "hsl(220,8%,50%)"],
      [1, "hsl(220,10%,30%)"],
    ]);
    rivetPositions.forEach((pos) => {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.beginPath();
      ctx.arc(0, 0, rivetRadius, 0, Math.PI * 2);
      ctx.fillStyle = rivetGrad;
      ctx.fill();
      ctx.strokeStyle = "hsla(220, 10%, 20%, 0.5)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    });

    // Outline
    ctx.strokeStyle = "hsl(220, 10%, 25%)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rectX + radius, rectY);
    ctx.lineTo(rectX + rectWidth - radius, rectY);
    ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
    ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
    ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
    ctx.lineTo(rectX + radius, rectY + rectHeight);
    ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
    ctx.lineTo(rectX, rectY + radius);
    ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
    ctx.closePath();
    ctx.stroke();

    if (isImageValid(img)) {
      // Preserve dim alpha for dual-choice; otherwise default to 0.95
      const isDimmed = powerUp.isDualChoice && ctx.globalAlpha < 0.5;
      if (!isDimmed) ctx.globalAlpha = 0.95;
      ctx.drawImage(img, 0, 0, size, size);
    } else if (debugEnabled) {
      ctx.fillStyle = "magenta";
      ctx.fillRect(0, 0, size, size);
    }

    ctx.restore();
  });

  // ═══ Draw dual-choice connectors (VS text between paired power-ups) ═══
  _drawnPairs.clear();
  powerUps.forEach((pu) => {
    if (!pu.active || !pu.isDualChoice || pu.pairedWithId === undefined) return;
    const a = Math.min(pu.id!, pu.pairedWithId);
    const b = Math.max(pu.id!, pu.pairedWithId);
    const pairKey = ((a + b) * (a + b + 1)) / 2 + b; // Cantor pairing – zero string allocs
    if (_drawnPairs.has(pairKey)) return;
    _drawnPairs.add(pairKey);

    const partner = powerUps.find((p) => p.active && p.id === pu.pairedWithId);
    if (!partner) return;

    const cx = (pu.x + pu.width / 2 + partner.x + partner.width / 2) / 2;
    const cy = (pu.y + pu.height / 2 + partner.y + partner.height / 2) / 2;

    // Glowing connecting line
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(now / 300) * 0.15;
    ctx.strokeStyle = "hsl(45, 100%, 70%)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pu.x + pu.width / 2, pu.y + pu.height / 2);
    ctx.lineTo(partner.x + partner.width / 2, partner.y + partner.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // "PICK ONE!" text
    ctx.globalAlpha = 1;
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "hsl(45, 100%, 85%)";
    ctx.fillText("PICK ONE!", cx, cy);
    ctx.restore();
  });

  // ═══ Draw bullets ═══
  bullets.forEach((bullet) => {
    const enableGlow = qualitySettings.glowEnabled;

    if (bullet.isSuper && bullet.isBounced) {
      ctx.fillStyle = "hsl(0, 90%, 55%)";
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
      if (enableGlow) {
        ctx.fillStyle = "hsla(0, 100%, 60%, 0.6)";
        ctx.fillRect(bullet.x - 3, bullet.y, bullet.width + 6, bullet.height + 10);
      }
      if (qualitySettings.level === "high") {
        for (let i = 0; i < 4; i++) {
          const offset = i * 8;
          const alpha = 0.6 - i * 0.15;
          const pSize = 4 - i * 0.8;
          ctx.fillStyle = `hsla(30, 100%, 60%, ${alpha})`;
          ctx.beginPath();
          ctx.arc(
            bullet.x + bullet.width / 2 + Math.sin(now * 0.053 + i * 2.3) * 3,
            bullet.y + bullet.height + offset,
            pSize,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    } else if (bullet.isSuper) {
      ctx.fillStyle = "hsl(45, 90%, 55%)";
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
      if (enableGlow) {
        ctx.fillStyle = "hsla(45, 100%, 70%, 0.5)";
        ctx.fillRect(bullet.x - 2, bullet.y, bullet.width + 4, bullet.height + 8);
      }
    } else if (bullet.isBounced) {
      ctx.fillStyle = "hsl(0, 85%, 55%)";
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    } else {
      ctx.fillStyle = "hsl(200, 70%, 50%)";
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }
  });

  // DANGER text for bounced bullets
  bullets
    .filter((b) => b.isBounced)
    .forEach((bullet) => {
      const paddleY = paddle?.y ?? height - 30;
      const dangerProgress = Math.min(1, Math.max(0, bullet.y / paddleY));
      const textScale = 1 + dangerProgress * 1;
      const textOpacity = 0.5 + dangerProgress * 0.5;
      const pulse = 1 + Math.sin(now / 100) * 0.15;
      const finalScale = textScale * pulse;

      ctx.save();
      ctx.font = `bold ${Math.floor(14 * finalScale)}px monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255, 50, 0, ${textOpacity})`;
      // shadowBlur removed — red text is readable without blur
      ctx.fillText("⚠ DANGER!", bullet.x + bullet.width / 2, bullet.y - 10 * finalScale);
      ctx.restore();
    });

  // Bullet impacts
  bulletImpacts.forEach((impact) => {
    const elapsed = now - impact.startTime;
    if (elapsed >= 500) return;
    const progress = elapsed / 500;
    const fadeOut = 1 - progress;

    const ringCount = impact.isSuper ? 4 : 2;
    for (let i = 0; i < ringCount; i++) {
      const ringRadius = 10 + progress * 50 + i * 10;
      const ringAlpha = fadeOut * (1 - i * 0.2);
      const color = impact.isSuper ? `hsla(45, 100%, 60%, ${ringAlpha})` : `hsla(200, 100%, 60%, ${ringAlpha})`;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 - i * 0.5;
      // shadowBlur removed — colored stroke rings + gradient flash are sufficient
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    const flashSize = (impact.isSuper ? 20 : 12) * (1 - progress * 0.5);
    const fadeBucket = Math.floor(fadeOut * 10);
    const flashSizeBucket = Math.round(flashSize);
    const flashGradient = impact.isSuper
      ? getCachedRadialGradient(
          ctx, `bulletImpactFlash_super_${fadeBucket}_${flashSizeBucket}`,
          0, 0, 0, 0, 0, flashSizeBucket,
          [
            [0, `rgba(255, 255, 200, ${fadeOut})`],
            [0.5, `rgba(255, 220, 50, ${fadeOut * 0.7})`],
            [1, "rgba(255, 180, 0, 0)"],
          ],
        )
      : getCachedRadialGradient(
          ctx, `bulletImpactFlash_norm_${fadeBucket}_${flashSizeBucket}`,
          0, 0, 0, 0, 0, flashSizeBucket,
          [
            [0, `rgba(200, 255, 255, ${fadeOut})`],
            [0.5, `rgba(50, 200, 255, ${fadeOut * 0.7})`],
            [1, "rgba(0, 150, 255, 0)"],
          ],
        );
    ctx.save();
    ctx.translate(impact.x, impact.y);
    ctx.fillStyle = flashGradient;
    ctx.beginPath();
    ctx.arc(0, 0, flashSizeBucket, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (impact.isSuper && qualitySettings.level !== "low") {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + progress * 3;
        const sparkDist = 15 + progress * 40;
        const sparkX = impact.x + Math.cos(angle) * sparkDist;
        const sparkY = impact.y + Math.sin(angle) * sparkDist;
        ctx.fillStyle = `rgba(255, 220, 50, ${fadeOut * 0.8})`;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 3 * fadeOut, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // shadowBlur removed
  });

  // ═══ Shield effects ═══
  if (paddle && paddle.hasShield) {
    const shieldPadding = 8;
    const shieldX = paddle.x - shieldPadding;
    const shieldY = paddle.y - shieldPadding - 5;
    const shieldWidth = paddle.width + shieldPadding * 2;
    const shieldHeight = paddle.height + shieldPadding * 2 + 5;

    if (qualitySettings.level === "low") {
      // shadowBlur removed — yellow stroke is visible without blur
      ctx.strokeStyle = "rgba(255, 220, 0, 0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      const r = 8;
      ctx.moveTo(shieldX + r, shieldY);
      ctx.lineTo(shieldX + shieldWidth - r, shieldY);
      ctx.arcTo(shieldX + shieldWidth, shieldY, shieldX + shieldWidth, shieldY + r, r);
      ctx.lineTo(shieldX + shieldWidth, shieldY + shieldHeight - r);
      ctx.arcTo(shieldX + shieldWidth, shieldY + shieldHeight, shieldX + shieldWidth - r, shieldY + shieldHeight, r);
      ctx.lineTo(shieldX + r, shieldY + shieldHeight);
      ctx.arcTo(shieldX, shieldY + shieldHeight, shieldX, shieldY + shieldHeight - r, r);
      ctx.lineTo(shieldX, shieldY + r);
      ctx.arcTo(shieldX, shieldY, shieldX + r, shieldY, r);
      ctx.closePath();
      ctx.stroke();
      // shadowBlur removed
    } else {
      const time = now / 1000;
      const pulseIntensity = 0.5 + Math.sin(time * 4) * 0.3;

      const layerCount = qualitySettings.level === 'high' ? 3 : 2;
      for (let layer = 0; layer < layerCount; layer++) {
        const layerOffset = layer * 2;
        const layerAlpha = (1 - layer * 0.3) * pulseIntensity;
        // shadowBlur removed — layered strokes convey depth without blur
        ctx.strokeStyle = `rgba(255, 220, 0, ${layerAlpha * 0.8})`;
        ctx.lineWidth = 3 - layer;
        ctx.beginPath();
        const r = 8;
        ctx.moveTo(shieldX - layerOffset + r, shieldY - layerOffset);
        ctx.lineTo(shieldX - layerOffset + shieldWidth - r, shieldY - layerOffset);
        ctx.arcTo(
          shieldX - layerOffset + shieldWidth,
          shieldY - layerOffset,
          shieldX - layerOffset + shieldWidth,
          shieldY - layerOffset + r,
          r,
        );
        ctx.lineTo(shieldX - layerOffset + shieldWidth, shieldY - layerOffset + shieldHeight - r);
        ctx.arcTo(
          shieldX - layerOffset + shieldWidth,
          shieldY - layerOffset + shieldHeight,
          shieldX - layerOffset + shieldWidth - r,
          shieldY - layerOffset + shieldHeight,
          r,
        );
        ctx.lineTo(shieldX - layerOffset + r, shieldY - layerOffset + shieldHeight);
        ctx.arcTo(
          shieldX - layerOffset,
          shieldY - layerOffset + shieldHeight,
          shieldX - layerOffset,
          shieldY - layerOffset + shieldHeight - r,
          r,
        );
        ctx.lineTo(shieldX - layerOffset, shieldY - layerOffset + r);
        ctx.arcTo(shieldX - layerOffset, shieldY - layerOffset, shieldX - layerOffset + r, shieldY - layerOffset, r);
        ctx.closePath();
        ctx.stroke();
      }

      // Electrical arcs — only on high quality
      if (qualitySettings.shieldArcsEnabled) {
        const arcCount = 6;
        for (let i = 0; i < arcCount; i++) {
          const arcTime = time * 3 + i * ((Math.PI * 2) / arcCount);
          const arcX = shieldX + shieldWidth / 2 + Math.cos(arcTime) * (shieldWidth / 2 - 5);
          const arcY = shieldY + shieldHeight / 2 + Math.sin(arcTime) * (shieldHeight / 2 - 5);
          const arcEndX = shieldX + shieldWidth / 2 + Math.cos(arcTime + 0.5) * (shieldWidth / 2);
          const arcEndY = shieldY + shieldHeight / 2 + Math.sin(arcTime + 0.5) * (shieldHeight / 2);
          const branchIntensity = (Math.sin(arcTime * 5) + 1) / 2;

          ctx.strokeStyle = `rgba(255, 255, 100, ${branchIntensity * 0.7})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(arcX, arcY);
          const segments = 4;
          for (let s = 1; s <= segments; s++) {
            const t = s / segments;
            const baseX = arcX + (arcEndX - arcX) * t;
            const baseY = arcY + (arcEndY - arcY) * t;
            const jitterX = Math.sin(now * 0.037 + i * 1.3 + s * 2.7) * 4;
            const jitterY = Math.cos(now * 0.041 + i * 1.7 + s * 3.1) * 4;
            ctx.lineTo(baseX + jitterX, baseY + jitterY);
          }
          ctx.stroke();
        }
      }

      // Inner energy fill
      const pulseBucket = Math.floor(pulseIntensity * 10);
      const shieldGrad = getCachedRadialGradient(
        ctx, `shieldEnergy_${pulseBucket}`,
        0, 0, 0,
        0, 0, shieldWidth / 2,
        [
          [0, `rgba(255, 255, 150, ${0.15 * pulseIntensity})`],
          [1, "rgba(255, 220, 0, 0)"],
        ],
      );
      ctx.save();
      ctx.translate(shieldX + shieldWidth / 2, shieldY + shieldHeight / 2);
      ctx.fillStyle = shieldGrad;
      const hw = shieldWidth / 2;
      const hh = shieldHeight / 2;
      ctx.beginPath();
      ctx.moveTo(-hw + 8, -hh);
      ctx.lineTo(hw - 8, -hh);
      ctx.arcTo(hw, -hh, hw, -hh + 8, 8);
      ctx.lineTo(hw, hh - 8);
      ctx.arcTo(hw, hh, hw - 8, hh, 8);
      ctx.lineTo(-hw + 8, hh);
      ctx.arcTo(-hw, hh, -hw, hh - 8, 8);
      ctx.lineTo(-hw, -hh + 8);
      ctx.arcTo(-hw, -hh, -hw + 8, -hh, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // shadowBlur removed
    }

    // Shield impact effects
    shieldImpacts.forEach((impact) => {
      const elapsed = now - impact.startTime;
      if (elapsed >= impact.duration) return;
      const progress = elapsed / impact.duration;
      const fadeOut = 1 - progress;
      const rippleRadius = 15 + progress * 40;
      const rippleCount = qualitySettings.level === 'low' ? 1 : (qualitySettings.level === 'medium' ? 2 : 3);

      for (let i = 0; i < rippleCount; i++) {
        const offset = i * 10;
        const alpha = fadeOut * (1 - i * 0.3);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        ctx.lineWidth = 3 - i;
        // shadowBlur removed
        ctx.beginPath();
        ctx.arc(impact.x, impact.y, rippleRadius + offset, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Flash gradient — skip on low quality
      if (qualitySettings.level !== "low") {
        const flashSize = 8 * (1 - progress * 0.5);
        const fadeBucket = Math.floor(fadeOut * 10);
        const flashGradient = getCachedRadialGradient(
          ctx, `shieldImpactFlash_${fadeBucket}`,
          0, 0, 0,
          0, 0, flashSize,
          [
            [0, `rgba(255, 255, 255, ${fadeOut * 0.9})`],
            [0.5, `rgba(255, 220, 0, ${fadeOut * 0.6})`],
            [1, "rgba(255, 220, 0, 0)"],
          ],
        );
        ctx.save();
        ctx.translate(impact.x, impact.y);
        ctx.fillStyle = flashGradient;
        ctx.beginPath();
        ctx.arc(0, 0, flashSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (qualitySettings.level !== "low") {
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + progress * Math.PI;
          const dist = 5 + progress * 25;
          const sx = impact.x + Math.cos(angle) * dist;
          const sy = impact.y + Math.sin(angle) * dist;
          const sparkSize = 3 * fadeOut;
          ctx.fillStyle = `rgba(255, 255, 200, ${fadeOut * 0.8})`;
          // shadowBlur removed
          ctx.fillRect(sx - sparkSize / 2, sy - sparkSize / 2, sparkSize, sparkSize);
        }
      }
      // shadowBlur removed
    });
  }

  // ═══ Second Chance safety net ═══
  if (paddle?.hasSecondChance) {
    const safetyNetY = paddle.y + paddle.height + 35;
    const lineStartX = 10;
    const lineEndX = width - 10;
    const time = now / 1000;

    ctx.save();
    if (qualitySettings.level === "low") {
      // shadowBlur removed
      ctx.strokeStyle = "rgba(0, 200, 255, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lineStartX, safetyNetY);
      ctx.lineTo(lineEndX, safetyNetY);
      ctx.stroke();
    } else {
      const pulseIntensity = 0.6 + Math.sin(time * 6) * 0.4;
      // shadowBlur removed
      ctx.strokeStyle = `rgba(0, 200, 255, ${pulseIntensity * 0.9})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lineStartX, safetyNetY);
      ctx.lineTo(lineEndX, safetyNetY);
      ctx.stroke();

      const arcCount = 12;
      for (let i = 0; i < arcCount; i++) {
        const arcProgress = (i + 1) / (arcCount + 1);
        const arcX = lineStartX + (lineEndX - lineStartX) * arcProgress;
        const arcPhase = time * 8 + i * 1.5;
        const arcHeight = Math.sin(arcPhase) * 12 * pulseIntensity;
        const branchIntensity = (Math.sin(arcPhase * 2) + 1) / 2;

        if (Math.abs(arcHeight) > 3) {
          ctx.strokeStyle = `rgba(100, 220, 255, ${branchIntensity * 0.8})`;
          ctx.lineWidth = 1.5;
          // shadowBlur removed
          ctx.beginPath();
          ctx.moveTo(arcX, safetyNetY);
          const segments = 3;
          const targetY = safetyNetY - arcHeight;
          for (let s = 1; s <= segments; s++) {
            const t = s / segments;
            const segY = safetyNetY + (targetY - safetyNetY) * t;
            // Deterministic jitter: replaces Math.random() in render hot-path
            const jitterX = Math.sin(now * 0.043 + i * 2.1 + s * 1.9) * 3;
            ctx.lineTo(arcX + jitterX, segY);
          }
          ctx.stroke();
        }
      }

      const sparkCount = 3;
      for (let s = 0; s < sparkCount; s++) {
        const sparkPhase = (time * 2 + s * 0.33) % 1;
        const sparkX = lineStartX + (lineEndX - lineStartX) * sparkPhase;
        const sparkGlow = Math.sin(sparkPhase * Math.PI);
        ctx.fillStyle = `rgba(255, 255, 255, ${sparkGlow * 0.9})`;
        // shadowBlur removed
        ctx.beginPath();
        ctx.arc(sparkX, safetyNetY, 3 + sparkGlow * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Second Chance impact effect
  if (secondChanceImpact) {
    const elapsed = now - secondChanceImpact.startTime;
    if (elapsed < 500) {
      const progress = elapsed / 500;
      const fadeOut = 1 - progress;
      const fadeBucket = Math.floor(fadeOut * 10);
      const waveRadius = 20 + progress * 80;
      const waveRadiusBucket = Math.round(waveRadius / 5) * 5; // quantize to 5px steps
      const waveGradient = getCachedRadialGradient(
        ctx, `scWave_${fadeBucket}_${waveRadiusBucket}`,
        0, 0, 0, 0, 0, waveRadiusBucket,
        [
          [0, `rgba(0, 255, 255, ${fadeOut * 0.8})`],
          [0.5, `rgba(0, 200, 255, ${fadeOut * 0.4})`],
          [1, "rgba(0, 200, 255, 0)"],
        ],
      );
      ctx.save();
      ctx.translate(secondChanceImpact.x, secondChanceImpact.y);
      ctx.fillStyle = waveGradient;
      ctx.beginPath();
      ctx.arc(0, 0, waveRadiusBucket, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();

      ctx.fillStyle = `rgba(255, 255, 255, ${fadeOut * 0.9})`;
      // shadowBlur removed
      ctx.beginPath();
      ctx.arc(secondChanceImpact.x, secondChanceImpact.y, 8 * fadeOut, 0, Math.PI * 2);
      ctx.fill();

      if (qualitySettings.level !== "low") {
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + progress * Math.PI * 2;
          const dist = 15 + progress * 40;
          const sx = secondChanceImpact.x + Math.cos(angle) * dist;
          const sy = secondChanceImpact.y + Math.sin(angle) * dist;
          ctx.strokeStyle = `rgba(100, 220, 255, ${fadeOut * 0.8})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(secondChanceImpact.x, secondChanceImpact.y);
          const midX = (secondChanceImpact.x + sx) / 2 + Math.sin(now * 0.047 + i * 1.9) * 5;
          const midY = (secondChanceImpact.y + sy) / 2 + Math.cos(now * 0.041 + i * 2.3) * 5;
          ctx.lineTo(midX, midY);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // ═══ Reflect shield ═══
  if (paddle?.hasReflectShield) {
    ctx.save();
    const rGrad = getCachedLinearGradient(
      ctx, `reflectShield_${Math.round(paddle.width)}`,
      0, 0, paddle.width + 10, 0,
      [
        [0, "rgba(192, 192, 192, 0.3)"],
        [0.5, "rgba(255, 255, 255, 0.6)"],
        [1, "rgba(192, 192, 192, 0.3)"],
      ],
    );
    ctx.translate(paddle.x - 5, paddle.y - 18);
    ctx.fillStyle = rGrad;
    ctx.fillRect(0, 0, paddle.width + 10, 12);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(now / 200) * 0.3})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, paddle.width + 10, 12);
    ctx.restore();
  }

  // ═══ Turrets ═══
  if (paddle && paddle.hasTurrets) {
    const turretWidth = 10;
    const turretHeight = 12;
    let turretHue = 0;
    let turretSat = 0;
    let turretLight = 60;
    let glowColor = "hsl(0, 0%, 60%)";

    if (paddle.hasSuperTurrets) {
      const maxShots = 45;
      const ammoRatio = Math.min((paddle.turretShots || 0) / maxShots, 1);
      turretHue = ammoRatio * 50;
      turretSat = 90;
      turretLight = 55;
      glowColor = `hsl(${turretHue}, ${turretSat}%, ${turretLight}%)`;
    }

    const mainColor = paddle.hasSuperTurrets ? `hsl(${turretHue}, ${turretSat}%, ${turretLight}%)` : "hsl(0, 0%, 60%)";
    const darkColor = paddle.hasSuperTurrets
      ? `hsl(${turretHue}, ${turretSat}%, ${turretLight - 20}%)`
      : "hsl(0, 0%, 40%)";

    // Left turret
    if (qualitySettings.shadowsEnabled) {
      drawRectShadow(ctx, paddle.x + 5 + 4, paddle.y - turretHeight + 4, turretWidth, turretHeight);
    }
    ctx.fillStyle = mainColor;
    ctx.fillRect(paddle.x + 5, paddle.y - turretHeight, turretWidth, turretHeight);
    ctx.fillStyle = darkColor;
    for (let i = 0; i < turretHeight; i += 3) {
      ctx.fillRect(paddle.x + 5, paddle.y - turretHeight + i, turretWidth, 1);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(paddle.x + 5, paddle.y - turretHeight, turretWidth, 2);

    // Right turret
    if (qualitySettings.shadowsEnabled) {
      drawRectShadow(ctx, paddle.x + paddle.width - 15 + 4, paddle.y - turretHeight + 4, turretWidth, turretHeight);
    }
    ctx.fillStyle = mainColor;
    ctx.fillRect(paddle.x + paddle.width - 15, paddle.y - turretHeight, turretWidth, turretHeight);
    ctx.fillStyle = darkColor;
    for (let i = 0; i < turretHeight; i += 3) {
      ctx.fillRect(paddle.x + paddle.width - 15, paddle.y - turretHeight + i, turretWidth, 1);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(paddle.x + paddle.width - 15, paddle.y - turretHeight, turretWidth, 2);

    // Ammo counter
    if (paddle.turretShots && paddle.turretShots > 0) {
      ctx.save();
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillStyle = paddle.hasSuperTurrets ? "hsl(45, 90%, 60%)" : "hsl(0, 0%, 80%)";
      // shadowBlur removed
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(paddle.turretShots.toString(), paddle.x + paddle.width / 2, paddle.y - turretHeight - 8);
      ctx.restore();
    }
  }

  // ═══ Draw enemies ═══
  drawEnemies(ctx, enemies, qualitySettings, now, boss);

  // ═══ Explosions ═══
  explosions.forEach((explosion) => {
    const progress = explosion.frame / explosion.maxFrames;
    const expRadius = 15 * (1 + progress * 2);
    const alpha = 1 - progress;

    let primaryHue = 30;
    let secondaryHue = 60;
    if (explosion.enemyType === "cube") {
      primaryHue = 200;
      secondaryHue = 180;
    } else if (explosion.enemyType === "sphere") {
      primaryHue = 330;
      secondaryHue = 350;
    } else if (explosion.enemyType === "pyramid") {
      primaryHue = 280;
      secondaryHue = 260;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    if (qualitySettings.glowEnabled) {
      // shadowBlur removed
    }
    ctx.strokeStyle = `hsla(${primaryHue}, 100%, 50%, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, expRadius, 0, Math.PI * 2);
    ctx.stroke();
    // shadowBlur removed
    ctx.fillStyle = `hsla(${secondaryHue}, 100%, 60%, ${alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, expRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Pooled particles (debris)
  const pooledParticles = particlePool.getActive();
  if (pooledParticles.length > 0) {
    ctx.save();
    const particleStep = Math.ceil(1 / qualitySettings.particleMultiplier);
    const enableGlow = qualitySettings.glowEnabled;
    for (let index = 0; index < pooledParticles.length; index += particleStep) {
      const particle = pooledParticles[index];
      const particleAlpha = particle.life / particle.maxLife;
      ctx.globalAlpha = particleAlpha;
      // shadowBlur removed
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
      // shadowBlur removed
      ctx.fillStyle = `rgba(255, 255, 255, ${particleAlpha * 0.8})`;
      ctx.fillRect(
        particle.x - particle.size / 4,
        particle.y - particle.size / 4,
        particle.size / 2,
        particle.size / 2,
      );
    }
    ctx.restore();
  }

  // ═══ Bombs and rockets ═══
  drawBombs(ctx, bombs, qualitySettings, now, assets);

  // ═══ Laser warnings ═══
  laserWarnings.forEach((warning) => {
    const elapsed = now - warning.startTime;
    const pulse = Math.abs(Math.sin(elapsed / 100));
    const warnAlpha = 0.4 + pulse * 0.6;
    const bossSource = boss || resurrectedBosses.find((b) => Math.abs(b.x + b.width / 2 - (warning.x + 4)) < 10);
    const startY = bossSource ? bossSource.y + bossSource.height : 0;

    ctx.save();
    // Glow effect: wide semi-transparent stroke behind the dashed line (replaces shadowBlur=15)
    ctx.strokeStyle = `rgba(255, 0, 0, ${warnAlpha * 0.35})`;
    ctx.lineWidth = 22;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(warning.x, startY);
    ctx.lineTo(warning.x, height);
    ctx.stroke();
    // Crisp dashed line on top — only if animated dashes enabled
    if (qualitySettings.animatedDashesEnabled) {
      ctx.strokeStyle = `rgba(255, 50, 50, ${warnAlpha})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -now / 30;
      ctx.beginPath();
      ctx.moveTo(warning.x, startY);
      ctx.lineTo(warning.x, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (elapsed > 300) {
      ctx.fillStyle = `rgba(255, 50, 50, ${warnAlpha * 0.8})`;
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("!!", warning.x + 4, height * 0.5);
    }
    ctx.restore();
  });

  // Super warnings
  superWarnings.forEach((warning) => {
    const elapsed = now - warning.startTime;
    const progress = elapsed / 800;
    const pulse = Math.abs(Math.sin(elapsed / 80));
    const alpha = 0.3 + pulse * 0.7;

    ctx.save();
    const ringCount = qualitySettings.superWarningEffects ? 3 : 1;
    for (let i = 0; i < ringCount; i++) {
      const ringRadius = 20 + progress * 80 + i * 15;
      const ringAlpha = alpha * (1 - i * 0.25);
      ctx.strokeStyle = `rgba(255, 100, 0, ${ringAlpha})`;
      ctx.lineWidth = 3 - i;
      ctx.beginPath();
      ctx.arc(warning.x, warning.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Animated spokes — only if superWarningEffects enabled
    if (qualitySettings.superWarningEffects) {
      ctx.strokeStyle = `rgba(255, 200, 50, ${alpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.lineDashOffset = -now / 20;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(warning.x, warning.y);
        ctx.lineTo(warning.x + Math.cos(angle) * 100, warning.y + Math.sin(angle) * 100);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Center glow (cached)
    const alphaBucket = Math.floor(alpha * 10);
    const cGrad = getCachedRadialGradient(
      ctx, `superWarningGlow_${alphaBucket}`,
      0, 0, 0,
      0, 0, 30,
      [
        [0, `rgba(255, 200, 100, ${alpha * 0.8})`],
        [0.5, `rgba(255, 100, 0, ${alpha * 0.4})`],
        [1, "rgba(255, 50, 0, 0)"],
      ],
    );
    ctx.save();
    ctx.translate(warning.x, warning.y);
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (progress > 0.2) {
      ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("!! SUPER !!", warning.x, warning.y - 50);
    }
    ctx.restore();
  });

  // ═══ Boss attacks ═══
  drawBossAttacks(ctx, bossAttacks, qualitySettings, now, assets);

  // ═══ Boss ═══
  if (boss) {
    drawBoss(
      ctx,
      boss,
      resurrectedBosses,
      level,
      qualitySettings,
      now,
      SHOW_BOSS_HITBOX,
      paddle,
      width,
      height,
      assets,
    );
  }

  // ═══ Resurrected bosses ═══
  resurrectedBosses.forEach((resBoss) => {
    const centerX = resBoss.x + resBoss.width / 2;
    const centerY = resBoss.y + resBoss.height / 2;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(resBoss.rotationY);
    const size = resBoss.width / 2;
    const baseHue = resBoss.isSuperAngry ? 0 : 280;
    const intensity = resBoss.isSuperAngry ? 75 : 65;

    // Outer glow: radial gradient circle drawn before the triangle (replaces shadowBlur=20)
    if (qualitySettings.glowEnabled) {
      ctx.save();
      const glowGrad = getCachedRadialGradient(ctx, `resBossGlow_${baseHue}`, 0, 0, 0, 0, 0, size * 1.6, [
        [0, `hsla(${baseHue}, 100%, 65%, 0.45)`],
        [1, `hsla(${baseHue}, 100%, 60%, 0)`],
      ]);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = `hsl(${baseHue}, 80%, ${intensity}%)`;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, size);
    ctx.lineTo(-size, size);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `hsl(${baseHue}, 90%, 70%)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const hbW = resBoss.width;
    const hbH = 4;
    const hbX = resBoss.x;
    const hbY = resBoss.y - 10;
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(hbX, hbY, hbW, hbH);
    const hpPercent = resBoss.currentHealth / resBoss.maxHealth;
    ctx.fillStyle = hpPercent > 0.5 ? "hsl(120, 80%, 50%)" : "hsl(0, 80%, 50%)";
    ctx.fillRect(hbX, hbY, hbW * hpPercent, hbH);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(hbX, hbY, hbW, hbH);
  });

  // ═══ Bonus letters ═══
  bonusLetters.forEach((letter) => {
    if (!letter.active) return;
    const img = assets.bonusLetterImages[letter.type];
    const size = letter.width;
    ctx.save();
    ctx.translate(letter.x + size / 2, letter.y + size / 2);
    // Glow effect: radial gradient circle behind the image (replaces shadowBlur=15)
    if (qualitySettings.glowEnabled) {
      const glowGrad = getCachedRadialGradient(ctx, "bonusLetterGlow", 0, 0, 0, 0, 0, size * 0.85, [
        [0, "hsla(280, 90%, 65%, 0.55)"],
        [1, "hsla(280, 90%, 60%, 0)"],
      ]);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isImageValid(img)) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = "hsl(280, 90%, 60%)";
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // Collected letters at top
  const letterOrder: BonusLetterType[] = ["Q", "U", "M", "R", "A", "N"];
  const letterSize = 40;
  const spacing = 20;
  const totalWidth = letterOrder.length * letterSize + (letterOrder.length - 1) * spacing;
  const startX = (width - totalWidth) / 2;
  const y = 20;
  letterOrder.forEach((letter, index) => {
    const img = assets.bonusLetterImages[letter];
    const x = startX + index * (letterSize + spacing);
    const isCollected = collectedLetters.has(letter as BonusLetterType);
    ctx.save();
    if (isImageValid(img)) {
      ctx.globalAlpha = isCollected ? 1 : 0.3;
      ctx.drawImage(img, x, y, letterSize, letterSize);
    }
    ctx.restore();
  });

  // ═══ Game state overlay ═══
  if (gameState !== "playing") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, width, height);
    if (gameState !== "paused") {
      ctx.font = "bold 32px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Double-text technique: offset dark shadow + bright fill (replaces shadowBlur=12)
      if (gameState === "ready") {
        ctx.fillStyle = "rgba(80, 0, 100, 0.8)";
        ctx.fillText("READY TO PLAY", width / 2 + 2, height / 2 + 2);
        ctx.fillStyle = "hsl(280, 60%, 55%)";
        ctx.fillText("READY TO PLAY", width / 2, height / 2);
      } else if (gameState === "gameOver") {
        ctx.fillStyle = "rgba(80, 0, 0, 0.8)";
        ctx.fillText("GAME OVER", width / 2 + 2, height / 2 + 2);
        ctx.fillStyle = "hsl(0, 75%, 55%)";
        ctx.fillText("GAME OVER", width / 2, height / 2);
      } else if (gameState === "won") {
        ctx.fillStyle = "rgba(0, 50, 0, 0.8)";
        ctx.fillText("YOU WON!", width / 2 + 2, height / 2 + 2);
        ctx.fillStyle = "hsl(120, 60%, 45%)";
        ctx.fillText("YOU WON!", width / 2, height / 2);
      }
    }
  }

  // Instructions overlay
  const waitingBall = balls.find((ball) => ball.waitingToLaunch);
  if (waitingBall && gameState === "playing") {
    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const instructionY1 = height * 0.78;
    const instructionY2 = height * 0.83;
    const instructionY3 = height * 0.88;
    const text1 = "USE A AND D OR LEFT AND RIGHT TO CHANGE THE ANGLE";
    const text2 = "MUSIC: N - NEXT | B - PREVIOUS | M - MUTE/UNMUTE | P - PAUSE";
    const text3 = "F - FULLSCREEN | ESC - RELEASE MOUSE";

    ctx.fillStyle = "rgba(80, 80, 80, 0.8)";
    ctx.fillText(text1, width / 2 + 2, instructionY1 + 2);
    ctx.fillStyle = "rgba(180, 180, 180, 0.95)";
    ctx.fillText(text1, width / 2, instructionY1);
    ctx.fillStyle = "rgba(80, 80, 80, 0.8)";
    ctx.fillText(text2, width / 2 + 2, instructionY2 + 2);
    ctx.fillStyle = "rgba(180, 180, 180, 0.95)";
    ctx.fillText(text2, width / 2, instructionY2);
    ctx.fillStyle = "rgba(80, 80, 80, 0.8)";
    ctx.fillText(text3, width / 2 + 2, instructionY3 + 2);
    ctx.fillStyle = "rgba(180, 180, 180, 0.95)";
    ctx.fillText(text3, width / 2, instructionY3);
  }

  // Final pooled particles (gameOver/highScore celebration) — circle-shaped (useCircle=true)
  // Debris particles (useCircle=false/undefined) already rendered above via the debris pass.
  // Both share the same pool; we skip debris ones here to avoid double-drawing.
  const activeParticles = particlePool.getActive();
  if (activeParticles.length > 0) {
    ctx.save();
    for (let i = 0; i < activeParticles.length; i++) {
      const particle = activeParticles[i];
      if (!particle.useCircle) continue; // Skip debris particles (already rendered above)
      const pAlpha = particle.life / particle.maxLife;
      ctx.globalAlpha = pAlpha;
      // Outer glow: slightly larger circle at low opacity (replaces shadowBlur=10)
      if (qualitySettings.glowEnabled && particle.size > 2) {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = pAlpha * 0.3;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = pAlpha;
      }
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      if (particle.size > 3) {
        ctx.fillStyle = `rgba(255, 255, 255, ${pAlpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ═══ Boss intro cinematic ═══
  if (bossIntroActive) {
    ctx.save();
    const pulseAlpha = 0.7 + Math.sin(now / 300) * 0.2;
    ctx.fillStyle = `rgba(0, 0, 0, ${pulseAlpha})`;
    ctx.fillRect(0, 0, width, height);

    const borderPulse = 5 + Math.sin(now / 200) * 3;
    ctx.strokeStyle = `rgba(255, 0, 0, ${0.6 + Math.sin(now / 250) * 0.4})`;
    ctx.lineWidth = borderPulse;
    ctx.strokeRect(borderPulse / 2, borderPulse / 2, width - borderPulse, height - borderPulse);

    if (boss) {
      const zoomPulse = 1 + Math.sin(now / 400) * 0.1;
      ctx.save();
      ctx.translate(boss.x + boss.width / 2, boss.y + boss.height / 2);
      ctx.scale(zoomPulse, zoomPulse);
      ctx.translate(-(boss.x + boss.width / 2), -(boss.y + boss.height / 2));
      const spotGrad = ctx.createRadialGradient(
        boss.x + boss.width / 2,
        boss.y + boss.height / 2,
        0,
        boss.x + boss.width / 2,
        boss.y + boss.height / 2,
        150,
      );
      spotGrad.addColorStop(0, "rgba(255, 255, 255, 0.3)");
      spotGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const warningY = height * 0.2;
    const textFlash = Math.sin(now / 150) > 0 ? 1 : 0.5;
    // Double-text technique for WARNING (replaces shadowBlur=20)
    ctx.fillStyle = `rgba(100, 0, 0, ${textFlash * 0.8})`;
    ctx.fillText("⚠ WARNING ⚠", width / 2 + 3, warningY + 3);
    ctx.fillStyle = `rgba(255, 50, 50, ${textFlash})`;
    ctx.fillText("⚠ WARNING ⚠", width / 2, warningY);
    // Double-text technique for BOSS APPROACHING (replaces shadowBlur=10)
    ctx.font = "bold 24px monospace";
    ctx.fillStyle = "rgba(80, 80, 0, 0.8)";
    ctx.fillText("BOSS APPROACHING", width / 2 + 2, warningY + 52);
    ctx.fillStyle = "rgba(255, 255, 100, 0.9)";
    ctx.fillText("BOSS APPROACHING", width / 2, warningY + 50);
    ctx.restore();
  }

  // Restore context after shake
  ctx.restore();
}

// ─── Enemy Drawing ───────────────────────────────────────────

function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: GameWorld["enemies"],
  qualitySettings: RenderState["qualitySettings"],
  now: number,
  boss: GameWorld["boss"],
): void {
  enemies.forEach((singleEnemy) => {
    ctx.save();
    const centerX = singleEnemy.x + singleEnemy.width / 2;
    const centerY = singleEnemy.y + singleEnemy.height / 2;

    if (singleEnemy.type === "crossBall") {
      const radius = singleEnemy.width / 2;
      const hits = singleEnemy.hits || 0;
      let hue: number;
      let saturation = 100;
      let lightness = 50;

      if (hits === 0) {
        const cycleSpeed = 200;
        const t = (now % (cycleSpeed * 4)) / (cycleSpeed * 4);
        if (t < 0.25) hue = t * 4 * 30;
        else if (t < 0.5) hue = 30 + (t - 0.25) * 4 * 30;
        else if (t < 0.75) hue = 60 - (t - 0.5) * 4 * 30;
        else hue = 30 - (t - 0.75) * 4 * 30;
      } else {
        hue = 60;
      }

      let baseColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      let highlightColor = `hsl(${hue}, ${saturation}%, ${lightness + 20}%)`;
      if (singleEnemy.isAngry) {
        const blinkPhase = Math.floor(now / 100) % 2;
        baseColor =
          blinkPhase === 0
            ? `hsl(${hue}, ${saturation}%, ${lightness + 10}%)`
            : `hsl(${hue}, ${saturation - 20}%, ${lightness - 15}%)`;
        highlightColor = `hsl(${hue}, ${saturation}%, ${lightness + 30}%)`;
      }

      if (qualitySettings.shadowsEnabled) {
        drawCircleShadow(ctx, centerX + 4, centerY + 4, radius);
      }

      const lightX = Math.cos(singleEnemy.rotationY) * radius * 0.4;
      const lightY = Math.sin(singleEnemy.rotationX) * radius * 0.4;

      if (qualitySettings.level === 'low') {
        // Low quality: flat fill avoids per-frame gradient creation
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const gradient = ctx.createRadialGradient(
          centerX + lightX,
          centerY + lightY,
          radius * 0.1,
          centerX,
          centerY,
          radius * 1.2,
        );
        gradient.addColorStop(0, highlightColor);
        gradient.addColorStop(0.3, baseColor);
        gradient.addColorStop(0.7, `hsl(${hue}, 60%, 25%)`);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const pulse = Math.abs(Math.sin(now / 100));
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 2 + pulse * 2;
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        const latY = centerY + i * radius * 0.3;
        const latRadius = Math.sqrt(radius * radius - i * radius * 0.3 * (i * radius * 0.3));
        const squeeze = Math.abs(Math.cos(singleEnemy.rotationX + i * 0.5));
        ctx.beginPath();
        ctx.ellipse(centerX, latY, latRadius * squeeze, latRadius * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      const specR = radius * 0.4;
      const specGradient = getCachedRadialGradient(ctx, `enemy_spec_${radius}`, 0, 0, 0, 0, 0, specR, [
        [0, "rgba(255,255,255,0.9)"],
        [1, "rgba(255,255,255,0)"],
      ]);
      const specX = centerX + lightX * 0.7;
      const specY = centerY + lightY * 0.7;
      ctx.save();
      ctx.translate(specX, specY);
      ctx.fillStyle = specGradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (singleEnemy.isAngry) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 8, centerY - 5);
        ctx.lineTo(centerX - 5, centerY);
        ctx.moveTo(centerX + 8, centerY - 5);
        ctx.lineTo(centerX + 5, centerY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX, centerY + 8, 6, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      }
    } else if (singleEnemy.type === "sphere") {
      const radius = singleEnemy.width / 2;
      let baseColor: string, highlightColor: string, darkColor: string;

      if (singleEnemy.isLargeSphere) {
        const hits = singleEnemy.hits || 0;
        if (hits === 0) {
          if (singleEnemy.isAngry) {
            const bp = Math.floor(now / 120) % 2;
            baseColor = bp === 0 ? "hsl(280, 90%, 55%)" : "hsl(280, 70%, 35%)";
            highlightColor = "hsl(280, 100%, 75%)";
            darkColor = "hsl(280, 60%, 20%)";
          } else {
            baseColor = "hsl(280, 80%, 50%)";
            highlightColor = "hsl(280, 90%, 70%)";
            darkColor = "hsl(280, 60%, 25%)";
          }
        } else if (hits === 1) {
          const bp = Math.floor(now / 110) % 2;
          baseColor = bp === 0 ? "hsl(30, 95%, 50%)" : "hsl(30, 80%, 35%)";
          highlightColor = "hsl(45, 100%, 70%)";
          darkColor = "hsl(20, 70%, 25%)";
        } else {
          const bp = Math.floor(now / 80) % 2;
          baseColor = bp === 0 ? "hsl(0, 95%, 55%)" : "hsl(0, 80%, 35%)";
          highlightColor = "hsl(0, 100%, 75%)";
          darkColor = "hsl(0, 70%, 20%)";
        }
      } else {
        baseColor = "hsl(200, 70%, 50%)";
        highlightColor = "hsl(200, 80%, 70%)";
        darkColor = "hsl(200, 60%, 30%)";
        if (singleEnemy.isAngry) {
          const bp = Math.floor(now / 150) % 2;
          baseColor = bp === 0 ? "hsl(0, 85%, 55%)" : "hsl(0, 75%, 40%)";
          highlightColor = "hsl(0, 90%, 75%)";
          darkColor = "hsl(0, 60%, 30%)";
        }
      }

      const lightX = Math.cos(singleEnemy.rotationY) * radius * 0.4;
      const lightY = Math.sin(singleEnemy.rotationX) * radius * 0.4;

      if (qualitySettings.shadowsEnabled) {
        drawCircleShadow(ctx, centerX + 4, centerY + 4, radius);
      }
      if (qualitySettings.level === 'low') {
        // Low quality: flat fill avoids per-frame gradient creation
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const gradient = ctx.createRadialGradient(
          centerX + lightX,
          centerY + lightY,
          radius * 0.1,
          centerX,
          centerY,
          radius * 1.2,
        );
        gradient.addColorStop(0, highlightColor);
        gradient.addColorStop(0.3, baseColor);
        gradient.addColorStop(0.7, darkColor);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Latitude/longitude lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        const latY = centerY + i * radius * 0.3;
        const latRadius = Math.sqrt(radius * radius - i * radius * 0.3 * (i * radius * 0.3));
        const squeeze = Math.abs(Math.cos(singleEnemy.rotationX + i * 0.5));
        ctx.beginPath();
        ctx.ellipse(centerX, latY, latRadius * squeeze, latRadius * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Specular — skip on low quality, use cached gradient otherwise
      if (qualitySettings.level !== 'low') {
        const specR = Math.round(radius * 0.4);
        const specGrad = getCachedRadialGradient(ctx, `enemy_sphere_spec_${specR}`, 0, 0, 0, 0, 0, specR, [
          [0, "rgba(255, 255, 255, 0.8)"],
          [1, "rgba(255, 255, 255, 0)"],
        ]);
        ctx.save();
        ctx.translate(centerX + lightX * 0.7, centerY + lightY * 0.7);
        ctx.fillStyle = specGrad;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (singleEnemy.isAngry) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 8, centerY - 5);
        ctx.lineTo(centerX - 5, centerY);
        ctx.moveTo(centerX + 8, centerY - 5);
        ctx.lineTo(centerX + 5, centerY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX, centerY + 8, 6, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      }
    } else if (singleEnemy.type === "pyramid") {
      const size = singleEnemy.width;
      let baseHue = 280;
      if (singleEnemy.hits === 1) baseHue = 50;
      else if (singleEnemy.hits === 2) baseHue = 0;
      let colorIntensity = 60;
      if (singleEnemy.isAngry) {
        const bp = Math.floor(now / 150) % 2;
        colorIntensity = bp === 0 ? 75 : 50;
      }

      const cos = Math.cos(singleEnemy.rotationY);
      const sin = Math.sin(singleEnemy.rotationY);
      const cosX = Math.cos(singleEnemy.rotationX);
      const sinX = Math.sin(singleEnemy.rotationX);

      const vertices = [
        [-1, 1, -1],
        [1, 1, -1],
        [1, 1, 1],
        [-1, 1, 1],
        [0, -1, 0],
      ];
      const projected = vertices.map(([x, y, z]) => {
        const ry = y * cosX - z * sinX;
        const rz = y * sinX + z * cosX;
        const rx2 = x * cos - rz * sin;
        const rz2 = x * sin + rz * cos;
        return [centerX + (rx2 * size) / 2, centerY + (ry * size) / 2, rz2];
      });

      const faces = [
        { indices: [0, 1, 4], color: `hsl(${baseHue}, ${colorIntensity}%, 40%)` },
        { indices: [1, 2, 4], color: `hsl(${baseHue}, ${colorIntensity}%, 50%)` },
        { indices: [2, 3, 4], color: `hsl(${baseHue}, ${colorIntensity}%, 60%)` },
        { indices: [3, 0, 4], color: `hsl(${baseHue}, ${colorIntensity}%, 45%)` },
        { indices: [0, 1, 2, 3], color: `hsl(${baseHue}, ${colorIntensity}%, 35%)` },
      ];

      const sortedFaces = faces
        .map((face) => ({
          ...face,
          avgZ: face.indices.reduce((sum, i) => sum + projected[i][2], 0) / face.indices.length,
        }))
        .sort((a, b) => a.avgZ - b.avgZ);

      if (qualitySettings.shadowsEnabled) {
        drawProjectedFacesShadow(ctx, projected, sortedFaces, 4, 4);
      }
      sortedFaces.forEach((face) => {
        ctx.fillStyle = face.color;
        ctx.beginPath();
        ctx.moveTo(projected[face.indices[0]][0], projected[face.indices[0]][1]);
        face.indices.forEach((i) => ctx.lineTo(projected[i][0], projected[i][1]));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (face.indices.length === 3) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
          ctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) {
            const t = (i + 1) / 4;
            const x1 = projected[face.indices[0]][0] * (1 - t) + projected[face.indices[2]][0] * t;
            const y1 = projected[face.indices[0]][1] * (1 - t) + projected[face.indices[2]][1] * t;
            const x2 = projected[face.indices[1]][0] * (1 - t) + projected[face.indices[2]][0] * t;
            const y2 = projected[face.indices[1]][1] * (1 - t) + projected[face.indices[2]][1] * t;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }
      });

      if (singleEnemy.isAngry) {
        // Double-fill technique: red shadow first, then white on top (no shadowBlur)
        ctx.fillStyle = "rgba(255, 0, 0, 0.6)";
        ctx.beginPath();
        ctx.moveTo(centerX - 10 + 1, centerY - 5 + 1);
        ctx.lineTo(centerX - 5 + 1, centerY - 5 + 1);
        ctx.lineTo(centerX - 7 + 1, centerY + 1);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(centerX + 10 + 1, centerY - 5 + 1);
        ctx.lineTo(centerX + 5 + 1, centerY - 5 + 1);
        ctx.lineTo(centerX + 7 + 1, centerY + 1);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.moveTo(centerX - 10, centerY - 5);
        ctx.lineTo(centerX - 5, centerY - 5);
        ctx.lineTo(centerX - 7, centerY);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(centerX + 10, centerY - 5);
        ctx.lineTo(centerX + 5, centerY - 5);
        ctx.lineTo(centerX + 7, centerY);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Cube enemy
      const size = singleEnemy.width;
      const cos = Math.cos(singleEnemy.rotationY);
      const sin = Math.sin(singleEnemy.rotationY);
      const cosX = Math.cos(singleEnemy.rotationX);
      const sinX = Math.sin(singleEnemy.rotationX);

      const vertices = [
        [-1, -1, -1],
        [1, -1, -1],
        [1, 1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
        [1, -1, 1],
        [1, 1, 1],
        [-1, 1, 1],
      ];
      const projected = vertices.map(([x, y, z]) => {
        const ry = y * cosX - z * sinX;
        const rz = y * sinX + z * cosX;
        const rx2 = x * cos - rz * sin;
        const rz2 = x * sin + rz * cos;
        return [centerX + (rx2 * size) / 2, centerY + (ry * size) / 2, rz2];
      });

      const faces = [
        { indices: [0, 1, 2, 3], color: "hsl(0, 75%, 40%)" },
        { indices: [0, 3, 7, 4], color: "hsl(0, 80%, 45%)" },
        { indices: [1, 5, 6, 2], color: "hsl(0, 80%, 50%)" },
        { indices: [0, 1, 5, 4], color: "hsl(0, 85%, 45%)" },
        { indices: [3, 2, 6, 7], color: "hsl(0, 85%, 55%)" },
        { indices: [4, 5, 6, 7], color: "hsl(0, 90%, 60%)" },
      ];

      const sortedFaces = faces
        .map((face) => ({
          ...face,
          avgZ: face.indices.reduce((sum, i) => sum + projected[i][2], 0) / 4,
        }))
        .sort((a, b) => a.avgZ - b.avgZ);

      if (qualitySettings.shadowsEnabled) {
        drawProjectedFacesShadow(ctx, projected, sortedFaces, 4, 4);
      }
      sortedFaces.forEach((face) => {
        ctx.fillStyle = face.color;
        ctx.beginPath();
        ctx.moveTo(projected[face.indices[0]][0], projected[face.indices[0]][1]);
        face.indices.forEach((i) => ctx.lineTo(projected[i][0], projected[i][1]));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }
    ctx.restore();
  });
}

// ─── Bomb Drawing ────────────────────────────────────────────

function drawBombs(
  ctx: CanvasRenderingContext2D,
  bombs: GameWorld["bombs"],
  qualitySettings: RenderState["qualitySettings"],
  now: number,
  assets: AssetRefs,
): void {
  bombs.forEach((bomb) => {
    const bombCenterX = bomb.x + bomb.width / 2;
    const bombCenterY = bomb.y + bomb.height / 2;
    const bombRotation = (now / 30) % 360;

    ctx.save();
    ctx.translate(bombCenterX, bombCenterY);
    ctx.rotate((bombRotation * Math.PI) / 180);

    if (bomb.type === "pyramidBullet") {
      if (qualitySettings.shadowsEnabled) {
        drawPolygonShadow(
          ctx,
          [
            [0, -bomb.height / 2],
            [bomb.width / 2, 0],
            [0, bomb.height / 2],
            [-bomb.width / 2, 0],
          ],
          3,
          3,
        );
      }
      ctx.fillStyle = "hsl(280, 70%, 55%)";
      ctx.beginPath();
      ctx.moveTo(0, -bomb.height / 2);
      ctx.lineTo(bomb.width / 2, 0);
      ctx.lineTo(0, bomb.height / 2);
      ctx.lineTo(-bomb.width / 2, 0);
      ctx.closePath();
      ctx.fill();
      const pyramidPulse = Math.abs(Math.sin(now / 150));
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + pyramidPulse * 0.5})`;
      ctx.lineWidth = 1.5 + pyramidPulse * 1.5;
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(-1, -2, bomb.width / 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (bomb.type === "rocket") {
      const rocketLength = bomb.width * 1.8;
      const rocketWidth = bomb.width * 0.6;
      const angle = Math.atan2(bomb.dy || 1, bomb.dx || 0);
      ctx.rotate(angle + Math.PI / 2);

      // Retro flat flame -- alternating orange/yellow triangle
      const flameFrame = Math.floor(now / 120) % 2;
      ctx.fillStyle = flameFrame === 0 ? "hsl(30, 100%, 55%)" : "hsl(50, 100%, 60%)";
      ctx.beginPath();
      ctx.moveTo(-rocketWidth * 0.5, rocketLength * 0.3);
      ctx.lineTo(0, rocketLength * 0.9);
      ctx.lineTo(rocketWidth * 0.5, rocketLength * 0.3);
      ctx.closePath();
      ctx.fill();

      // Retro flat body -- two-tone polygon
      if (qualitySettings.shadowsEnabled) {
        drawRectShadow(ctx, -bomb.width * 0.9 + 3, -bomb.width * 0.3 + 3, bomb.width * 1.8, bomb.width * 0.6);
      }
      ctx.fillStyle = "hsl(0, 0%, 80%)";
      ctx.beginPath();
      ctx.moveTo(0, -rocketLength * 0.5);
      ctx.lineTo(rocketWidth * 0.5, -rocketLength * 0.1);
      ctx.lineTo(rocketWidth * 0.5, rocketLength * 0.3);
      ctx.lineTo(-rocketWidth * 0.5, rocketLength * 0.3);
      ctx.lineTo(-rocketWidth * 0.5, -rocketLength * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "hsl(0, 0%, 60%)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ff3333";
      ctx.beginPath();
      ctx.moveTo(0, -rocketLength * 0.5);
      ctx.lineTo(rocketWidth * 0.35, -rocketLength * 0.2);
      ctx.lineTo(-rocketWidth * 0.35, -rocketLength * 0.2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.moveTo(-rocketWidth * 0.5, rocketLength * 0.1);
      ctx.lineTo(-rocketWidth * 1.0, rocketLength * 0.4);
      ctx.lineTo(-rocketWidth * 0.5, rocketLength * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rocketWidth * 0.5, rocketLength * 0.1);
      ctx.lineTo(rocketWidth * 1.0, rocketLength * 0.4);
      ctx.lineTo(rocketWidth * 0.5, rocketLength * 0.3);
      ctx.closePath();
      ctx.fill();
    } else {
      if (qualitySettings.shadowsEnabled) {
        drawCircleShadow(ctx, 3, 3, bomb.width / 2);
      }
      ctx.fillStyle = "hsl(0, 85%, 55%)";
      ctx.beginPath();
      ctx.arc(0, 0, bomb.width / 2, 0, Math.PI * 2);
      ctx.fill();
      const bombPulse = Math.abs(Math.sin(now / 100));
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + bombPulse * 0.5})`;
      ctx.lineWidth = 1.5 + bombPulse * 1.5;
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.beginPath();
      ctx.arc(-2, -2, bomb.width / 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

// ─── Boss Attack Drawing ─────────────────────────────────────

function drawBossAttacks(
  ctx: CanvasRenderingContext2D,
  bossAttacks: GameWorld["bossAttacks"],
  qualitySettings: RenderState["qualitySettings"],
  now: number,
  assets: AssetRefs,
): void {
  bossAttacks.forEach((attack) => {
    if (attack.type === "laser") {
      if (qualitySettings.shadowsEnabled) {
        drawRectShadow(ctx, attack.x + 3, attack.y + 3, attack.width, attack.height);
      }
      ctx.fillStyle = "rgba(255, 50, 50, 0.9)";
      ctx.fillRect(attack.x, attack.y, attack.width, attack.height);
      ctx.fillStyle = "rgba(255, 200, 200, 0.6)";
      ctx.fillRect(attack.x + attack.width * 0.2, attack.y, attack.width * 0.6, attack.height);
      const laserPulse = Math.abs(Math.sin(now / 80));
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + laserPulse * 0.4})`;
      ctx.lineWidth = 2 + laserPulse * 2;
      ctx.strokeRect(attack.x, attack.y, attack.width, attack.height);
    } else if (attack.type === "rocket") {
      ctx.save();
      ctx.translate(attack.x + attack.width / 2, attack.y + attack.height / 2);
      const angle = Math.atan2(attack.dy || 1, attack.dx || 0);
      ctx.rotate(angle + Math.PI / 2);
      const rocketLength = attack.height * 1.5;
      const rocketWidth = attack.width * 1.2;

      // Retro smoke trail: 4 simple shrinking circles, alternating grey tones
      for (let i = 0; i < 4; i++) {
        const smokeOffset = rocketLength * 0.5 + i * 14;
        const smokeSize = 6 - i * 1.2;
        const isLight = i % 2 === 0;
        ctx.fillStyle = isLight ? "hsl(0, 0%, 65%)" : "hsl(0, 0%, 45%)";
        ctx.beginPath();
        ctx.arc(0, smokeOffset, smokeSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Flat flame triangle behind rocket
      ctx.fillStyle = "hsl(30, 100%, 55%)";
      ctx.beginPath();
      ctx.moveTo(-rocketWidth * 0.3, rocketLength * 0.35);
      ctx.lineTo(0, rocketLength * 0.9);
      ctx.lineTo(rocketWidth * 0.3, rocketLength * 0.35);
      ctx.closePath();
      ctx.fill();
      // Inner flame highlight
      ctx.fillStyle = "hsl(50, 100%, 65%)";
      ctx.beginPath();
      ctx.moveTo(-rocketWidth * 0.15, rocketLength * 0.4);
      ctx.lineTo(0, rocketLength * 0.75);
      ctx.lineTo(rocketWidth * 0.15, rocketLength * 0.4);
      ctx.closePath();
      ctx.fill();

      // Geometric rocket body (flat polygons, no image)
      // Nose cone
      ctx.fillStyle = "hsl(0, 75%, 50%)";
      ctx.beginPath();
      ctx.moveTo(0, -rocketLength * 0.45);
      ctx.lineTo(rocketWidth * 0.35, -rocketLength * 0.1);
      ctx.lineTo(-rocketWidth * 0.35, -rocketLength * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "hsl(0, 90%, 70%)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Body rectangle
      ctx.fillStyle = "hsl(0, 60%, 40%)";
      ctx.fillRect(-rocketWidth * 0.3, -rocketLength * 0.1, rocketWidth * 0.6, rocketLength * 0.45);
      ctx.strokeStyle = "hsl(0, 80%, 60%)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-rocketWidth * 0.3, -rocketLength * 0.1, rocketWidth * 0.6, rocketLength * 0.45);

      // Fins
      ctx.fillStyle = "hsl(0, 70%, 45%)";
      ctx.beginPath();
      ctx.moveTo(-rocketWidth * 0.3, rocketLength * 0.25);
      ctx.lineTo(-rocketWidth * 0.55, rocketLength * 0.4);
      ctx.lineTo(-rocketWidth * 0.3, rocketLength * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rocketWidth * 0.3, rocketLength * 0.25);
      ctx.lineTo(rocketWidth * 0.55, rocketLength * 0.4);
      ctx.lineTo(rocketWidth * 0.3, rocketLength * 0.35);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    } else if (attack.type === "cross") {
      const cycleSpeed = 200;
      const t = (now % (cycleSpeed * 4)) / (cycleSpeed * 4);
      let hue: number;
      if (t < 0.25) hue = t * 4 * 30;
      else if (t < 0.5) hue = 30 + (t - 0.25) * 4 * 30;
      else if (t < 0.75) hue = 60 - (t - 0.5) * 4 * 30;
      else hue = 30 - (t - 0.75) * 4 * 30;

      if (!attack.isStopped && attack.dx !== undefined && attack.dy !== undefined) {
        const trailLength = 6;
        for (let i = trailLength; i >= 1; i--) {
          const trailX = attack.x - attack.dx * i * 2.5;
          const trailY = attack.y - attack.dy * i * 2.5;
          const trailOpacity = 0.4 * (1 - i / (trailLength + 1));
          const trailSize = (attack.width / 2) * (1 - i / (trailLength + 2));
          ctx.save();
          ctx.globalAlpha = trailOpacity;
          ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
          ctx.beginPath();
          ctx.arc(trailX + attack.width / 2, trailY + attack.height / 2, trailSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.save();
      ctx.translate(attack.x + attack.width / 2, attack.y + attack.height / 2);
      const rotationSpeed = attack.isStopped ? 100 : 30;
      ctx.rotate(((now / rotationSpeed) * Math.PI) / 180);
      const fillColor = `hsl(${hue}, 100%, 50%)`;
      if (qualitySettings.shadowsEnabled) {
        drawCircleShadow(ctx, 3, 3, attack.width / 2);
      }
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(0, 0, attack.width / 2, 0, Math.PI * 2);
      ctx.fill();
      const pulse = Math.abs(Math.sin(now / 100));
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 2 + pulse * 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(-3, -3, attack.width / 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (attack.isStopped && attack.pendingDirection) {
        ctx.save();
        ctx.translate(attack.x + attack.width / 2, attack.y + attack.height / 2);
        const dirAngle = Math.atan2(attack.pendingDirection.dy, attack.pendingDirection.dx);
        ctx.rotate(dirAngle);
        const arrowPulse = 0.7 + Math.sin(now / 80) * 0.3;
        const arrowOffset = attack.width / 2 + 4;
        const arrowSize = 8;
        // Double-fill: glow layer then white (no shadowBlur)
        ctx.fillStyle = `rgba(255, 255, 255, ${arrowPulse * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(arrowOffset + arrowSize + 2, 0);
        ctx.lineTo(arrowOffset - 1, -arrowSize * 0.8);
        ctx.lineTo(arrowOffset + arrowSize * 0.3, 0);
        ctx.lineTo(arrowOffset - 1, arrowSize * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${arrowPulse})`;
        ctx.beginPath();
        ctx.moveTo(arrowOffset + arrowSize, 0);
        ctx.lineTo(arrowOffset, -arrowSize * 0.6);
        ctx.lineTo(arrowOffset + arrowSize * 0.3, 0);
        ctx.lineTo(arrowOffset, arrowSize * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else {
      ctx.save();
      ctx.translate(attack.x + attack.width / 2, attack.y + attack.height / 2);
      ctx.rotate(((now / 30) * Math.PI) / 180);
      if (qualitySettings.shadowsEnabled) {
        drawCircleShadow(ctx, 3, 3, attack.width / 2);
      }
      ctx.fillStyle = attack.type === "super" ? "hsl(280, 80%, 60%)" : "hsl(25, 85%, 50%)";
      ctx.beginPath();
      ctx.arc(0, 0, attack.width / 2, 0, Math.PI * 2);
      ctx.fill();
      const projectilePulse = Math.abs(Math.sin(now / 100));
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + projectilePulse * 0.5})`;
      ctx.lineWidth = 1.5 + projectilePulse * 1.5;
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(-2, -2, attack.width / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

// ─── Boss Drawing (stub - delegates to specific boss type) ───

function drawBoss(
  ctx: CanvasRenderingContext2D,
  boss: NonNullable<GameWorld["boss"]>,
  resurrectedBosses: GameWorld["resurrectedBosses"],
  level: number,
  qualitySettings: RenderState["qualitySettings"],
  now: number,
  showHitbox: boolean,
  paddle: GameWorld["paddle"],
  width: number,
  height: number,
  assets: AssetRefs,
): void {
  // Boss stun effect
  if (boss.isStunned) {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(now / 100) * 0.3;
    ctx.strokeStyle = "#00FFFF";
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const angle = (now / 500 + (i * Math.PI) / 3) % (2 * Math.PI);
      const r = boss.width / 2 + 10;
      const x = boss.x + boss.width / 2 + Math.cos(angle) * r;
      const y = boss.y + boss.height / 2 + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(now * 0.051 + i * 1.7) * 5, y + Math.cos(now * 0.043 + i * 2.1) * 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  const centerX = boss.x + boss.width / 2;
  const centerY = boss.y + boss.height / 2;

  ctx.save();
  ctx.translate(centerX, centerY);

  if (level === 20 && isMegaBoss(boss)) {
    // Mega boss rendering - simplified for brevity, kept identical to original
    drawMegaBoss(ctx, boss as MegaBoss, qualitySettings, now, showHitbox, paddle, width, height, assets);
  } else if (boss.type === "cube") {
    drawCubeBoss(ctx, boss, qualitySettings, now);
  } else if (boss.type === "sphere") {
    drawSphereBoss(ctx, boss, qualitySettings, now);
  } else if (boss.type === "pyramid") {
    const size = boss.width / 2;
    const baseHue = boss.isAngry ? 0 : 280;
    const intensity = boss.isSuperAngry ? 75 : boss.isAngry ? 65 : 60;
    ctx.rotate(boss.rotationY);
    if (qualitySettings.shadowsEnabled) {
      drawPolygonShadow(
        ctx,
        [
          [0, -size],
          [size, size],
          [-size, size],
        ],
        5,
        5,
      );
    }
    ctx.fillStyle = `hsl(${baseHue}, 80%, ${intensity}%)`;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, size);
    ctx.lineTo(-size, size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `hsl(${baseHue}, 70%, ${intensity + 10}%)`;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(0, 0);
    ctx.lineTo(-size, size);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `hsl(${baseHue}, 90%, 70%)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, size);
    ctx.lineTo(-size, size);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();

  // Health bar (skip for mega boss)
  if (!(level === 20 && isMegaBoss(boss))) {
    const hbWidth = boss.width + 40;
    const hbHeight = 10;
    const hbX = boss.x + boss.width / 2 - hbWidth / 2;
    const hbY = boss.y - 25;
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(hbX, hbY, hbWidth, hbHeight);
    const hpPercent = boss.currentHealth / boss.maxHealth;
    const hpHue = hpPercent > 0.5 ? 120 : hpPercent > 0.25 ? 60 : 0;
    ctx.fillStyle = `hsl(${hpHue}, 80%, 50%)`;
    ctx.fillRect(hbX, hbY, hbWidth * hpPercent, hbHeight);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(hbX, hbY, hbWidth, hbHeight);
  }
}

// ─── Cube Boss ───────────────────────────────────────────────

function drawCubeBoss(
  ctx: CanvasRenderingContext2D,
  boss: NonNullable<GameWorld["boss"]>,
  qualitySettings: RenderState["qualitySettings"],
  now: number,
): void {
  const halfSize = boss.width / 2;
  const baseHue = boss.isAngry ? 0 : 180;
  const vertices = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ];
  const cosX = Math.cos(boss.rotationX);
  const sinX = Math.sin(boss.rotationX);
  const cosY = Math.cos(boss.rotationY);
  const sinY = Math.sin(boss.rotationY);

  const projected = vertices.map(([x, y, z]) => {
    const ry = y * cosX - z * sinX;
    const rz = y * sinX + z * cosX;
    const rx2 = x * cosY - rz * sinY;
    const rz2 = x * sinY + rz * cosY;
    return [rx2 * halfSize, ry * halfSize, rz2];
  });

  const faces = [
    { indices: [0, 1, 2, 3], lightness: 40 },
    { indices: [4, 5, 6, 7], lightness: 60 },
    { indices: [0, 3, 7, 4], lightness: 48 },
    { indices: [1, 2, 6, 5], lightness: 52 },
    { indices: [3, 2, 6, 7], lightness: 55 },
    { indices: [0, 1, 5, 4], lightness: 45 },
  ];

  const sortedFaces = faces
    .map((face) => ({
      ...face,
      avgZ: face.indices.reduce((sum, i) => sum + projected[i][2], 0) / 4,
    }))
    .sort((a, b) => a.avgZ - b.avgZ);

  if (qualitySettings.shadowsEnabled) {
    drawProjectedFacesShadow(ctx, projected, sortedFaces, 5, 5);
  }
  sortedFaces.forEach((face) => {
    ctx.fillStyle = `hsl(${baseHue}, 80%, ${face.lightness}%)`;
    ctx.beginPath();
    ctx.moveTo(projected[face.indices[0]][0], projected[face.indices[0]][1]);
    face.indices.forEach((i) => ctx.lineTo(projected[i][0], projected[i][1]));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `hsl(${baseHue}, 90%, 70%)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// ─── Sphere Boss ─────────────────────────────────────────────

function drawSphereBoss(
  ctx: CanvasRenderingContext2D,
  boss: NonNullable<GameWorld["boss"]>,
  qualitySettings: RenderState["qualitySettings"],
  now: number,
): void {
  const radius = boss.width / 2;
  const baseHue = boss.isAngry ? 0 : 200;
  const oscillation = now / 500;

  const angryKey = boss.isAngry ? "1" : "0";
  const mainGrad = getCachedRadialGradient(ctx, `bsphere_${angryKey}`, -radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius, [
    [0, `hsl(${baseHue}, 80%, 75%)`],
    [0.3, `hsl(${baseHue}, 70%, 55%)`],
    [0.7, `hsl(${baseHue}, 60%, 35%)`],
    [1, `hsl(${baseHue}, 50%, 15%)`],
  ]);

  if (qualitySettings.shadowsEnabled) {
    drawCircleShadow(ctx, 5, 5, radius);
  }
  ctx.fillStyle = mainGrad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // Grid lines
  ctx.strokeStyle = `hsla(${baseHue}, 60%, 60%, 0.3)`;
  ctx.lineWidth = 1;
  ctx.save();
  ctx.rotate(oscillation * 0.3);
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.15, radius, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.15, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const highlightOffset = Math.sin(oscillation) * radius * 0.1;
  ctx.fillStyle = `rgba(255, 255, 255, ${boss.isAngry ? 0.6 : 0.4})`;
  ctx.beginPath();
  ctx.ellipse(
    -radius * 0.3 + highlightOffset,
    -radius * 0.35,
    radius * 0.2,
    radius * 0.12,
    -Math.PI / 4,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // Angry face
  if (boss.isAngry) {
    const eyeSize = radius * 0.12;
    const eyeY = -radius * 0.1;
    const eyeSpacing = radius * 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-eyeSpacing - eyeSize, eyeY - eyeSize, eyeSize * 2, eyeSize * 2);
    ctx.fillRect(eyeSpacing - eyeSize, eyeY - eyeSize, eyeSize * 2, eyeSize * 2);
    const pupilOffset = Math.sin(oscillation) * eyeSize * 0.3;
    ctx.fillStyle = "#000000";
    ctx.fillRect(-eyeSpacing - eyeSize * 0.5 + pupilOffset, eyeY - eyeSize * 0.5, eyeSize, eyeSize);
    ctx.fillRect(eyeSpacing - eyeSize * 0.5 + pupilOffset, eyeY - eyeSize * 0.5, eyeSize, eyeSize);
    ctx.fillStyle = "#000000";
    const browY = eyeY - eyeSize * 1.8;
    const browThickness = eyeSize * 0.5;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(
        -eyeSpacing - eyeSize + i * eyeSize * 0.6,
        browY + i * browThickness * 0.4,
        eyeSize * 0.7,
        browThickness,
      );
    }
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(
        eyeSpacing + eyeSize - i * eyeSize * 0.6 - eyeSize * 0.7,
        browY + i * browThickness * 0.4,
        eyeSize * 0.7,
        browThickness,
      );
    }
    const mouthY = radius * 0.35;
    const mouthWidth = radius * 0.5;
    ctx.fillRect(-mouthWidth, mouthY, mouthWidth * 0.3, eyeSize * 0.6);
    ctx.fillRect(-mouthWidth * 0.5, mouthY + eyeSize * 0.4, mouthWidth * 0.3, eyeSize * 0.6);
    ctx.fillRect(0, mouthY, mouthWidth * 0.3, eyeSize * 0.6);
    ctx.fillRect(mouthWidth * 0.5, mouthY + eyeSize * 0.4, mouthWidth * 0.3, eyeSize * 0.6);
  }

  if (boss.isAngry) {
    const pulse = Math.sin(now / 100) * 0.5 + 0.5;
    ctx.strokeStyle = `hsla(0, 100%, 70%, ${0.5 + pulse * 0.5})`;
    ctx.lineWidth = 3 + pulse * 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ─── Mega Boss Drawing ───────────────────────────────────────
// This is a simplified version - the full mega boss rendering
// is complex with multiple phases. Using the essential visual elements.

function drawMegaBoss(
  ctx: CanvasRenderingContext2D,
  megaBoss: MegaBoss,
  qualitySettings: RenderState["qualitySettings"],
  now: number,
  showHitbox: boolean,
  paddle: GameWorld["paddle"],
  width: number,
  height: number,
  assets: AssetRefs,
): void {
  const boss = megaBoss;
  const radius = boss.width / 2;
  const hexRotation = boss.rotationY || 0;

  // Phase-based color palette (tech-style)
  const phaseHue = megaBoss.corePhase === 3 ? 355 : megaBoss.corePhase === 2 ? 35 : 210;
  const phaseSat = megaBoss.corePhase === 3 ? 35 : megaBoss.corePhase === 2 ? 40 : 25;

  // Helper: draw a small hexagonal bolt
  const drawHexBolt = (bx: number, by: number, boltR: number, hue: number, sat: number) => {
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const ba = (Math.PI / 3) * j - Math.PI / 2;
      const px = bx + Math.cos(ba) * boltR;
      const py = by + Math.sin(ba) * boltR;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `hsl(${hue}, ${sat}%, 45%)`;
    ctx.fill();
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const ba = (Math.PI / 3) * j - Math.PI / 2;
      const px = bx + Math.cos(ba) * (boltR * 0.5);
      const py = by + Math.sin(ba) * (boltR * 0.5);
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `hsl(${hue}, ${sat}%, 25%)`;
    ctx.fill();
  };

  // Rotating hexagon body
  ctx.save();
  ctx.rotate(hexRotation);

  if (qualitySettings.shadowsEnabled && megaBoss.corePhase === 1) {
    drawHexShadow(ctx, radius, 5, 5);
  }

  // === SPIKES for Phase 2/3 (drawn before inner shield, behind everything) ===
  if (megaBoss.outerShieldRemoved) {
    const spikeHue = phaseHue;
    const spikeSat = phaseSat;
    const isPhase3 = megaBoss.corePhase >= 3;
    const spikeLen = isPhase3 ? radius * 0.45 : radius * 0.35;
    const spikeBase = 12;

    // 6 vertex spikes
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const vx = Math.cos(angle) * radius;
      const vy = Math.sin(angle) * radius;
      const tipX = Math.cos(angle) * (radius + spikeLen);
      const tipY = Math.sin(angle) * (radius + spikeLen);
      const perpX = Math.cos(angle + Math.PI / 2) * (spikeBase / 2);
      const perpY = Math.sin(angle + Math.PI / 2) * (spikeBase / 2);

      ctx.beginPath();
      ctx.moveTo(vx + perpX, vy + perpY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(vx - perpX, vy - perpY);
      ctx.closePath();
      ctx.fillStyle = `hsl(${spikeHue}, ${spikeSat}%, 22%)`;
      ctx.fill();
      ctx.strokeStyle = `hsl(${spikeHue}, ${spikeSat + 15}%, 50%)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Phase 3: 6 midpoint spikes that pulse
    if (isPhase3) {
      const pulseFactor = Math.sin(now / 300) * 0.15 + 0.85;
      const midSpikeLen = spikeLen * pulseFactor;
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2 + Math.PI / 6; // midpoints
        const vx = Math.cos(angle) * radius;
        const vy = Math.sin(angle) * radius;
        const tipX = Math.cos(angle) * (radius + midSpikeLen);
        const tipY = Math.sin(angle) * (radius + midSpikeLen);
        const perpX = Math.cos(angle + Math.PI / 2) * (spikeBase / 2);
        const perpY = Math.sin(angle + Math.PI / 2) * (spikeBase / 2);

        ctx.beginPath();
        ctx.moveTo(vx + perpX, vy + perpY);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(vx - perpX, vy - perpY);
        ctx.closePath();
        ctx.fillStyle = `hsl(${spikeHue}, ${spikeSat + 10}%, 28%)`;
        ctx.fill();
        ctx.strokeStyle = `hsl(${spikeHue}, ${spikeSat + 20}%, 55%)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // Outer shield hexagon (tech-style panel lines + rivets)
  if (!megaBoss.outerShieldRemoved) {
    const faceLightness = [38, 32, 28, 30, 34, 40];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const nextAngle = (Math.PI / 3) * ((i + 1) % 6) - Math.PI / 2;
      const x1 = Math.cos(angle) * radius;
      const y1 = Math.sin(angle) * radius;
      const x2 = Math.cos(nextAngle) * radius;
      const y2 = Math.sin(nextAngle) * radius;
      const midAngle = (angle + nextAngle) / 2;
      const cpX = Math.cos(midAngle) * (radius * 1.06);
      const cpY = Math.sin(midAngle) * (radius * 1.06);

      // Main face fill
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x1, y1);
      ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      ctx.closePath();
      ctx.fillStyle = `hsl(${phaseHue}, ${phaseSat}%, ${faceLightness[i]}%)`;
      ctx.fill();
      ctx.strokeStyle = `hsl(${phaseHue}, ${phaseSat + 15}%, 55%)`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Panel line (inner stroke at 80% scale)
      const scale = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x1 * scale, y1 * scale);
      ctx.lineTo(x2 * scale, y2 * scale);
      ctx.closePath();
      ctx.strokeStyle = `hsl(${phaseHue}, ${phaseSat}%, ${faceLightness[i] - 8}%)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 2 rivet dots per face
      const r1x = x1 * 0.55 + x2 * 0.15;
      const r1y = y1 * 0.55 + y2 * 0.15;
      const r2x = x1 * 0.15 + x2 * 0.55;
      const r2y = y1 * 0.15 + y2 * 0.55;
      ctx.fillStyle = `hsl(${phaseHue}, ${phaseSat}%, 55%)`;
      ctx.beginPath();
      ctx.arc(r1x, r1y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r2x, r2y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer hex border
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const nextAngle = (Math.PI / 3) * ((i + 1) % 6) - Math.PI / 2;
      const x1 = Math.cos(angle) * radius;
      const y1 = Math.sin(angle) * radius;
      const x2 = Math.cos(nextAngle) * radius;
      const y2 = Math.sin(nextAngle) * radius;
      if (i === 0) ctx.moveTo(x1, y1);
      const midAngle = (angle + nextAngle) / 2;
      const cpX = Math.cos(midAngle) * (radius * 1.06);
      const cpY = Math.sin(midAngle) * (radius * 1.06);
      ctx.quadraticCurveTo(cpX, cpY, x2, y2);
    }
    ctx.closePath();
    ctx.strokeStyle = `hsl(${phaseHue}, ${phaseSat + 20}%, 60%)`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Vertex hexagonal bolts (instead of circles)
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const vx = Math.cos(angle) * (radius * 0.85);
      const vy = Math.sin(angle) * (radius * 0.85);
      drawHexBolt(vx, vy, 6, phaseHue, phaseSat);
    }
  }

  // Inner octagon shield (with segmented panel lines + crosshair)
  if (megaBoss.outerShieldRemoved && !megaBoss.coreExposed) {
    const innerOctRadius = radius * 0.65;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i - Math.PI / 8;
      const ox = Math.cos(angle) * innerOctRadius;
      const oy = Math.sin(angle) * innerOctRadius;
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
    }
    ctx.closePath();
    ctx.fillStyle = `hsla(${phaseHue}, ${phaseSat + 10}%, 35%, 0.7)`;
    ctx.fill();
    const innerPulseOn = Math.floor(now / 200) % 2 === 0;
    ctx.strokeStyle = innerPulseOn ? `hsl(${phaseHue}, 80%, 65%)` : `hsl(${phaseHue}, 60%, 42%)`;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Segmented panel lines radiating from center
    ctx.strokeStyle = `hsl(${phaseHue}, ${phaseSat}%, 28%)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i - Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * innerOctRadius * 0.9, Math.sin(angle) * innerOctRadius * 0.9);
      ctx.stroke();
    }

    // Crosshair glyph at center
    const chLen = 8;
    ctx.strokeStyle = `hsl(${phaseHue}, ${phaseSat + 20}%, 55%)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-chLen, 0);
    ctx.lineTo(chLen, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -chLen);
    ctx.lineTo(0, chLen);
    ctx.stroke();
  }

  ctx.restore(); // End rotation

  // Core (with concentric ring + targeting reticle)
  const coreRadius = megaBoss.coreExposed ? radius * 0.4 : radius * 0.3;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
  const coreAlt = Math.floor(now / 180) % 2 === 0;
  if (megaBoss.coreExposed) {
    ctx.fillStyle = coreAlt ? "hsl(45, 100%, 65%)" : "hsl(30, 90%, 50%)";
  } else {
    const coreFills: Record<number, [string, string]> = {
      3: [`hsl(${phaseHue}, 60%, 50%)`, `hsl(${phaseHue}, 50%, 32%)`],
      2: [`hsl(${phaseHue}, 60%, 50%)`, `hsl(${phaseHue}, 50%, 32%)`],
      1: [`hsl(${phaseHue}, 50%, 50%)`, `hsl(${phaseHue}, 40%, 32%)`],
    };
    const [fillA, fillB] = coreFills[megaBoss.corePhase] || coreFills[1];
    ctx.fillStyle = coreAlt ? fillA : fillB;
  }
  ctx.fill();
  const coreBorderColor = megaBoss.coreExposed ? "hsl(55, 100%, 60%)" : `hsl(${phaseHue}, 50%, 65%)`;
  ctx.strokeStyle = coreBorderColor;
  ctx.lineWidth = megaBoss.coreExposed ? 4 : 3;
  ctx.stroke();

  // Concentric inner ring at 60% radius
  const innerCoreR = coreRadius * 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, innerCoreR, 0, Math.PI * 2);
  ctx.fillStyle = megaBoss.coreExposed
    ? coreAlt
      ? "hsl(30, 90%, 45%)"
      : "hsl(45, 100%, 60%)"
    : `hsl(${phaseHue}, ${phaseSat + 10}%, ${coreAlt ? 40 : 28}%)`;
  ctx.fill();
  ctx.strokeStyle = coreBorderColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 4 targeting reticle tick marks
  ctx.strokeStyle = coreBorderColor;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const ta = (Math.PI / 2) * i;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ta) * (coreRadius * 0.85), Math.sin(ta) * (coreRadius * 0.85));
    ctx.lineTo(Math.cos(ta) * (coreRadius * 1.1), Math.sin(ta) * (coreRadius * 1.1));
    ctx.stroke();
  }

  // Highlight circle on core
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.beginPath();
  ctx.arc(-coreRadius * 0.25, -coreRadius * 0.25, coreRadius * 0.25, 0, Math.PI * 2);
  ctx.fill();

  if (megaBoss.coreExposed) {
    const hatchOn = Math.floor(now / 160) % 2 === 0;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = hatchOn ? "hsl(55, 100%, 60%)" : "hsl(55, 80%, 35%)";
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  // Cannon (tech-style with panel lines + exhaust ports)
  if (megaBoss.cannonExtended && megaBoss.trappedBall && paddle) {
    ctx.save();
    const paddleCenterX = paddle.x + paddle.width / 2 - (boss.x + boss.width / 2);
    const paddleCenterY = paddle.y - (boss.y + boss.height / 2);
    const angleToTarget = Math.atan2(paddleCenterY, paddleCenterX) - Math.PI / 2;
    ctx.rotate(angleToTarget);

    const cannonWidth = 36;
    const cannonLength = 55;
    const cannonBaseY = radius * 0.5;

    // Rounded barrel
    const cornerR = 8;
    const bx = -cannonWidth / 2;
    const by = cannonBaseY;
    const bw = cannonWidth;
    const bh = cannonLength;
    ctx.fillStyle = `hsl(${phaseHue}, ${phaseSat}%, 22%)`;
    ctx.beginPath();
    ctx.moveTo(bx + cornerR, by);
    ctx.lineTo(bx + bw - cornerR, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + cornerR, cornerR);
    ctx.lineTo(bx + bw, by + bh - cornerR);
    ctx.arcTo(bx + bw, by + bh, bx + bw - cornerR, by + bh, cornerR);
    ctx.lineTo(bx + cornerR, by + bh);
    ctx.arcTo(bx, by + bh, bx, by + bh - cornerR, cornerR);
    ctx.lineTo(bx, by + cornerR);
    ctx.arcTo(bx, by, bx + cornerR, by, cornerR);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `hsl(${phaseHue}, ${phaseSat + 20}%, 48%)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2 horizontal panel lines across barrel
    const seg = cannonLength / 3;
    ctx.strokeStyle = `hsl(${phaseHue}, ${phaseSat}%, 32%)`;
    ctx.lineWidth = 1;
    for (let s = 1; s <= 2; s++) {
      const ly = cannonBaseY + seg * s;
      ctx.beginPath();
      ctx.moveTo(-cannonWidth / 2, ly);
      ctx.lineTo(cannonWidth / 2, ly);
      ctx.stroke();
    }

    // Exhaust port details (small darker rectangles on each side)
    ctx.fillStyle = `hsl(${phaseHue}, ${phaseSat}%, 15%)`;
    ctx.fillRect(-cannonWidth / 2 - 3, cannonBaseY + cannonLength * 0.4, 3, 8);
    ctx.fillRect(cannonWidth / 2, cannonBaseY + cannonLength * 0.4, 3, 8);

    // Blinking muzzle half-circle (only outward-facing half)
    const muzzleBlink = Math.floor(now / 200) % 2 === 0;
    const muzzleY = cannonBaseY + cannonLength;
    ctx.beginPath();
    ctx.arc(0, muzzleY, 10, 0, Math.PI);
    ctx.fillStyle = muzzleBlink ? "hsl(40, 100%, 60%)" : "hsl(40, 80%, 35%)";
    ctx.fill();
    ctx.strokeStyle = "hsl(40, 90%, 70%)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // === HP BARS (all phases) ===
  const hbWidth = boss.width + 60;
  const hbHeight = 14;
  const hbX = -hbWidth / 2;
  const hbY = -boss.height / 2 - 35;

  // Phase-specific HP values and colors
  let hpPercent: number;
  let barColor: string;
  let phaseLabel: string;
  let borderColor: string;

  if (!megaBoss.outerShieldRemoved) {
    // Phase 1: outer shield
    hpPercent = megaBoss.outerShieldHP / megaBoss.outerShieldMaxHP;
    barColor = megaBoss.coreExposed ? "hsl(60, 100%, 50%)" : "hsl(280, 80%, 50%)";
    borderColor = "rgba(200, 150, 255, 0.8)";
    phaseLabel = megaBoss.coreExposed ? "CORE EXPOSED!" : "MEGA BOSS";
  } else if (megaBoss.corePhase === 2) {
    hpPercent = megaBoss.innerShieldHP / megaBoss.innerShieldMaxHP;
    barColor = megaBoss.coreExposed ? "hsl(60, 100%, 50%)" : "hsl(35, 90%, 50%)";
    borderColor = "rgba(255, 180, 80, 0.8)";
    phaseLabel = megaBoss.coreExposed ? "CORE EXPOSED!" : "PHASE 2";
  } else {
    hpPercent = megaBoss.innerShieldHP / megaBoss.innerShieldMaxHP;
    barColor = megaBoss.coreExposed ? "hsl(60, 100%, 50%)" : "hsl(0, 80%, 50%)";
    borderColor = "rgba(255, 100, 100, 0.8)";
    phaseLabel = megaBoss.coreExposed ? "CORE EXPOSED!" : "PHASE 3";
  }

  // Main HP bar
  ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
  ctx.fillRect(hbX, hbY, hbWidth, hbHeight);
  ctx.fillStyle = barColor;
  ctx.fillRect(hbX + 2, hbY + 2, (hbWidth - 4) * Math.max(0, hpPercent), hbHeight - 4);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(hbX, hbY, hbWidth, hbHeight);

  // Label
  ctx.fillStyle = barColor;
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(phaseLabel, 0, hbY - 5);

  // Phase indicator pips (3 small squares)
  const pipSize = 6;
  const pipGap = 4;
  const pipStartX = -(pipSize * 3 + pipGap * 2) / 2;
  const pipY = hbY + hbHeight + 4;
  for (let p = 0; p < 3; p++) {
    const px = pipStartX + p * (pipSize + pipGap);
    ctx.fillStyle = p < megaBoss.corePhase ? "hsl(45, 100%, 60%)" : "rgba(255,255,255,0.2)";
    ctx.fillRect(px, pipY, pipSize, pipSize);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, pipY, pipSize, pipSize);
  }

  // Core hits bar (during danger ball phase)
  if (megaBoss.trappedBall) {
    const chbY = pipY + pipSize + 4;
    const chbHeight = 8;
    const coreHitsPercent = megaBoss.coreHitsFromDangerBalls / 5; // dangerBallsToComplete
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(hbX, chbY, hbWidth, chbHeight);
    ctx.fillStyle = "hsl(50, 100%, 55%)";
    ctx.fillRect(hbX + 2, chbY + 2, (hbWidth - 4) * Math.min(1, coreHitsPercent), chbHeight - 4);
    ctx.strokeStyle = "rgba(255, 255, 150, 0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(hbX, chbY, hbWidth, chbHeight);
    ctx.fillStyle = "hsl(50, 100%, 65%)";
    ctx.font = "bold 9px monospace";
    ctx.fillText("CORE HITS", 0, chbY - 2);
  }

  ctx.textAlign = "left";
}
