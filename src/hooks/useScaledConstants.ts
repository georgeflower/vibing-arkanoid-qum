import { useMemo } from "react";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
  BALL_RADIUS,
  BRICK_COLS,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  BRICK_PADDING,
  BRICK_OFFSET_TOP,
  POWERUP_SIZE,
  POWERUP_FALL_SPEED,
} from "@/constants/game";

export interface ScaledConstants {
  // Platform detection
  isMac: boolean;
  scaleFactor: number;

  // Canvas
  canvasWidth: number;
  canvasHeight: number;

  // Paddle
  paddleWidth: number;
  paddleHeight: number;
  paddleStartY: number;

  // Ball
  ballRadius: number;

  // Bricks
  brickWidth: number;
  brickHeight: number;
  brickPadding: number;
  brickOffsetTop: number;
  brickOffsetLeft: number;

  // Power-ups
  powerUpSize: number;
  powerUpFallSpeed: number;

  // Bullet
  bulletWidth: number;
  bulletHeight: number;
  bulletSpeed: number;
}

export function useScaledConstants(resolutionOverride?: { width: number; height: number }): ScaledConstants {
  const overrideW = resolutionOverride?.width;
  const overrideH = resolutionOverride?.height;

  return useMemo(() => {
    // Detect Mac and apply 10% scale reduction
    const isMac =
      /Mac|iPhone|iPad|iPod/.test(navigator.platform) ||
      /Macintosh/.test(navigator.userAgent);
    const macFactor = isMac ? 0.9 : 1;

    // Base dimensions: use override or default constants
    const baseWidth = overrideW ?? CANVAS_WIDTH;
    const baseHeight = overrideH ?? CANVAS_HEIGHT;

    // Scale factor relative to default canvas size (for entity sizing)
    const resScale = baseWidth / CANVAS_WIDTH;
    const scaleFactor = macFactor * resScale;

    const canvasWidth = baseWidth * macFactor;
    const canvasHeight = baseHeight * macFactor;
    const paddleWidth = PADDLE_WIDTH * scaleFactor;
    const paddleHeight = PADDLE_HEIGHT * scaleFactor;
    const ballRadius = BALL_RADIUS * scaleFactor;
    const brickWidth = BRICK_WIDTH * scaleFactor;
    const brickHeight = BRICK_HEIGHT * scaleFactor;
    const brickPadding = BRICK_PADDING * scaleFactor;
    const brickOffsetTop = BRICK_OFFSET_TOP * scaleFactor;
    const brickOffsetLeft =
      (canvasWidth - (BRICK_COLS * brickWidth + (BRICK_COLS - 1) * brickPadding)) / 2;

    return {
      isMac,
      scaleFactor,
      canvasWidth,
      canvasHeight,
      paddleWidth,
      paddleHeight,
      paddleStartY: 60 * scaleFactor,
      ballRadius,
      brickWidth,
      brickHeight,
      brickPadding,
      brickOffsetTop,
      brickOffsetLeft,
      powerUpSize: POWERUP_SIZE * scaleFactor,
      powerUpFallSpeed: POWERUP_FALL_SPEED * scaleFactor,
      bulletWidth: 4 * scaleFactor,
      bulletHeight: 12 * scaleFactor,
      bulletSpeed: 8 * scaleFactor,
    };
  }, [overrideW, overrideH]);
}
