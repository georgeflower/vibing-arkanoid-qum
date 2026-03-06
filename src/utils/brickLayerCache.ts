/**
 * Brick Layer Cache - Offscreen canvas rendering for bricks
 * Pre-renders brick layout to reduce per-frame draw calls from ~1000 to 1
 */

import type { Brick } from "@/types/game";
import type { QualitySettings } from "@/hooks/useAdaptiveQuality";

// Defensive helper for canvas arc calls (prevents DOMException on negative/non-finite radius)
const safeArcRadius = (r: number): number => (Number.isFinite(r) ? Math.max(0.001, r) : 0.001);

interface BrickLayerCacheData {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  version: number;
  lastBrickHash: string;
  width: number;
  height: number;
}

export class BrickRenderer {
  private cache: BrickLayerCacheData | null = null;
  private crackedImages: HTMLImageElement[] = [];
  private isInitialized = false;

  /**
   * Initialize the offscreen canvas
   */
  initialize(width: number, height: number): void {
    // Try OffscreenCanvas first, fallback to regular canvas
    let canvas: OffscreenCanvas | HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext("2d");
    } else {
      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext("2d");
    }

    if (!ctx) {
      console.error("[BrickRenderer] Failed to get 2D context");
      return;
    }

    this.cache = {
      canvas,
      ctx,
      version: 0,
      lastBrickHash: "",
      width,
      height
    };
    this.isInitialized = true;
  }

  /**
   * Set cracked brick images for texture rendering
   */
  setCrackedImages(
    img1: HTMLImageElement,
    img2: HTMLImageElement,
    img3: HTMLImageElement
  ): void {
    this.crackedImages = [img1, img2, img3];
  }

  /**
   * Calculate hash of brick state for dirty checking
   * Only tracks visibility and hit state - what changes during gameplay
   */
  private calculateBrickHash(bricks: Brick[]): string {
    let hash = 0;
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (b.visible) {
        hash = (hash * 31 + b.id) | 0;
        hash = (hash * 31 + b.hitsRemaining) | 0;
      }
    }
    return hash.toString(36);
  }

  /**
   * Helper function to detect adjacent metal bricks for seamless rendering
   */
  private getAdjacentMetalBricks(brick: Brick, allBricks: Brick[]) {
    const tolerance = 6;
    return {
      top: allBricks.find(
        (b) =>
          b.visible &&
          b.type === "metal" &&
          Math.abs(b.x - brick.x) < tolerance &&
          Math.abs(b.y + b.height - brick.y) < tolerance
      ),
      bottom: allBricks.find(
        (b) =>
          b.visible &&
          b.type === "metal" &&
          Math.abs(b.x - brick.x) < tolerance &&
          Math.abs(b.y - (brick.y + brick.height)) < tolerance
      ),
      left: allBricks.find(
        (b) =>
          b.visible &&
          b.type === "metal" &&
          Math.abs(b.y - brick.y) < tolerance &&
          Math.abs(b.x + b.width - brick.x) < tolerance
      ),
      right: allBricks.find(
        (b) =>
          b.visible &&
          b.type === "metal" &&
          Math.abs(b.y - brick.y) < tolerance &&
          Math.abs(b.x - (brick.x + brick.width)) < tolerance
      )
    };
  }

  /**
   * Check if image is valid and loaded
   */
  private isImageValid(img: HTMLImageElement | null): img is HTMLImageElement {
    return !!(img && img.complete && img.naturalHeight !== 0);
  }

  /**
   * Render a single brick to the offscreen context
   */
  private renderBrick(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    brick: Brick,
    allBricks: Brick[],
    qualitySettings: QualitySettings
  ): void {
    ctx.shadowBlur = 0;

    if (brick.type === "metal") {
      const adjacent = this.getAdjacentMetalBricks(brick, allBricks);

      // Steel base color
      ctx.fillStyle = "hsl(0, 0%, 33%)";
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

      // Top metallic highlight
      if (!adjacent.top) {
        ctx.fillStyle = "rgba(200, 200, 200, 0.4)";
        ctx.fillRect(brick.x, brick.y, brick.width, 4);
      }

      // Left metallic shine
      if (!adjacent.left) {
        ctx.fillStyle = "rgba(200, 200, 200, 0.4)";
        ctx.fillRect(brick.x, brick.y, 4, brick.height);
      }

      // Darker bottom
      if (!adjacent.bottom) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(brick.x, brick.y + brick.height - 4, brick.width, 4);
      }

      // Right shadow
      if (!adjacent.right) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(brick.x + brick.width - 4, brick.y, 4, brick.height);
      }

      // Steel rivets pattern
      ctx.fillStyle = "rgba(100, 100, 100, 0.8)";
      const rivetSize = 3;
      const spacing = 12;
      for (let py = brick.y + spacing / 2; py < brick.y + brick.height; py += spacing) {
        for (let px = brick.x + spacing / 2; px < brick.x + brick.width; px += spacing) {
          ctx.beginPath();
          ctx.arc(px, py, safeArcRadius(rivetSize), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Diagonal hatching pattern
      ctx.strokeStyle = "rgba(150, 150, 150, 0.15)";
      ctx.lineWidth = 1;
      for (let i = 0; i < brick.width + brick.height; i += 6) {
        ctx.beginPath();
        ctx.moveTo(brick.x + i, brick.y);
        ctx.lineTo(brick.x, brick.y + i);
        ctx.stroke();
      }
    } else if (brick.type === "explosive") {
      // Base color
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

      // Top highlight
      ctx.fillStyle = "rgba(255, 255, 100, 0.3)";
      ctx.fillRect(brick.x, brick.y, brick.width, 3);

      // Bottom shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(brick.x, brick.y + brick.height - 3, brick.width, 3);

      // Warning pattern (dotted)
      ctx.strokeStyle = "rgba(50, 50, 50, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i < brick.width + brick.height; i += 8) {
        ctx.beginPath();
        ctx.moveTo(brick.x + i, brick.y);
        ctx.lineTo(brick.x, brick.y + i);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Bomb emojis
      ctx.fillStyle = "rgba(255, 200, 0, 0.8)";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const bombsText = "💥".repeat(brick.hitsRemaining);
      ctx.fillText(bombsText, brick.x + brick.width / 2, brick.y + brick.height / 2);
    } else if (brick.type === "cracked") {
      let crackedImage: HTMLImageElement | null = null;
      if (brick.hitsRemaining === 3 && this.crackedImages[0]) {
        crackedImage = this.crackedImages[0];
      } else if (brick.hitsRemaining === 2 && this.crackedImages[1]) {
        crackedImage = this.crackedImages[1];
      } else if (brick.hitsRemaining === 1 && this.crackedImages[2]) {
        crackedImage = this.crackedImages[2];
      }

      if (crackedImage && this.isImageValid(crackedImage)) {
        ctx.drawImage(crackedImage, brick.x, brick.y, brick.width, brick.height);
      } else {
        // Fallback rendering
        ctx.fillStyle = brick.color;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(brick.x, brick.y, brick.width, 3);
        ctx.fillRect(brick.x, brick.y, 3, brick.height);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(brick.x, brick.y + brick.height - 3, brick.width, 3);
        ctx.fillRect(brick.x + brick.width - 3, brick.y, 3, brick.height);
      }
    } else {
      // Normal brick
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

      // Top highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(brick.x, brick.y, brick.width, 3);
      ctx.fillRect(brick.x, brick.y, 3, brick.height);

      // Bottom shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(brick.x, brick.y + brick.height - 3, brick.width, 3);
      ctx.fillRect(brick.x + brick.width - 3, brick.y, 3, brick.height);

      // 16-bit pixel pattern texture
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      for (let py = brick.y + 4; py < brick.y + brick.height - 4; py += 4) {
        for (let px = brick.x + 4; px < brick.x + brick.width - 4; px += 4) {
          if ((px + py) % 8 === 0) {
            ctx.fillRect(px, py, 2, 2);
          }
        }
      }

      // Draw hit counter for multi-hit bricks
      if (brick.maxHits > 1) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.font = "bold 12px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          brick.hitsRemaining.toString(),
          brick.x + brick.width / 2,
          brick.y + brick.height / 2
        );
      }
    }
  }

  /**
   * Update the cache if bricks have changed
   * Returns true if cache was rebuilt
   */
  updateCache(bricks: Brick[], qualitySettings: QualitySettings): boolean {
    if (!this.cache || !this.isInitialized) return false;

    const newHash = this.calculateBrickHash(bricks);
    if (newHash === this.cache.lastBrickHash) {
      return false; // No changes
    }

    // Clear and redraw
    const ctx = this.cache.ctx;
    ctx.clearRect(0, 0, this.cache.width, this.cache.height);

    // Render all visible bricks
    for (let i = 0; i < bricks.length; i++) {
      const brick = bricks[i];
      if (brick.visible) {
        this.renderBrick(ctx, brick, bricks, qualitySettings);
      }
    }

    this.cache.lastBrickHash = newHash;
    this.cache.version++;
    return true;
  }

  /**
   * Draw cached layer to main canvas
   */
  drawToCanvas(ctx: CanvasRenderingContext2D): void {
    if (!this.cache || !this.isInitialized) return;

    ctx.drawImage(this.cache.canvas as CanvasImageSource, 0, 0);
  }

  /**
   * Force rebuild on next frame
   */
  invalidate(): void {
    if (this.cache) {
      this.cache.lastBrickHash = "";
    }
  }

  /**
   * Resize the cache canvas
   */
  resize(width: number, height: number): void {
    if (!this.cache) {
      this.initialize(width, height);
      return;
    }

    if (this.cache.width === width && this.cache.height === height) {
      return;
    }

    // Recreate canvas with new size
    this.initialize(width, height);
    this.invalidate();
  }

  /**
   * Check if cache is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.cache !== null;
  }

  /**
   * Get cache statistics
   */
  getStats(): { version: number; width: number; height: number } | null {
    if (!this.cache) return null;
    return {
      version: this.cache.version,
      width: this.cache.width,
      height: this.cache.height
    };
  }
}

// Singleton instance
export const brickRenderer = new BrickRenderer();
