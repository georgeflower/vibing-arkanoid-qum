import { forwardRef, useEffect, useRef, useState } from "react";
import { renderState, createAssetRefs, type AssetRefs } from "@/engine/renderState";
import { startRenderLoop, warmUpCanvasContexts } from "@/engine/renderLoop";
import { warmUpGradients } from "@/engine/canvasRenderer";
import { world } from "@/engine/state";
import { brickRenderer } from "@/utils/brickLayerCache";
import { powerUpImages } from "@/utils/powerUpImages";
import { bonusLetterImages } from "@/utils/bonusLetterImages";

// Asset imports
import paddleImg from "@/assets/paddle.png";
import paddleTurretsImg from "@/assets/paddle-turrets.png";
import crackedBrick1 from "@/assets/brick-cracked-1.png";
import crackedBrick2 from "@/assets/brick-cracked-2.png";
import crackedBrick3 from "@/assets/brick-cracked-3.png";
import backgroundTile4 from "@/assets/background-tile-4.png";
import backgroundTile69 from "@/assets/background-tile-6-9.png";
import backgroundTile1114 from "@/assets/background-tile-11-14.png";
import backgroundTile1620 from "@/assets/background-tile-16-20.png";
import bossLevel5Bg from "@/assets/boss-level-5-bg.png";
import bossLevel10Bg from "@/assets/boss-level-10-bg.png";
import bossLevel15Bg from "@/assets/boss-level-15-bg.png";
import bossLevel20Bg from "@/assets/boss-level-20-bg.png";
import megaBossSprite from "@/assets/mega-boss.png";
import missileImg from "@/assets/missile.png";

interface GameCanvasProps {
  width: number;
  height: number;
}

type PatternBackgroundImageAssetKey =
  | "backgroundImage4"
  | "backgroundImage69"
  | "backgroundImage1114"
  | "backgroundImage1620";

type BackgroundImageAssetKey =
  | PatternBackgroundImageAssetKey
  | "bossLevel5Bg"
  | "bossLevel10Bg"
  | "bossLevel15Bg"
  | "bossLevel20Bg";

const backgroundPatternKeys: Record<PatternBackgroundImageAssetKey, string> = {
  backgroundImage4: "bg4",
  backgroundImage69: "bg69",
  backgroundImage1114: "bg1114",
  backgroundImage1620: "bg1620",
};

function waitForImageDecode(img: HTMLImageElement): Promise<void> {
  if (typeof img.decode === "function") {
    return img.decode().catch(() => {});
  }

  if (img.complete) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
}

export const GameCanvas = forwardRef<HTMLCanvasElement, GameCanvasProps>(
  ({ width, height }, ref) => {
    const assetsRef = useRef<AssetRefs>(createAssetRefs());
    const stopLoopRef = useRef<(() => void) | null>(null);
    const warmedBrickCacheKeyRef = useRef("");
    const [crackedImagesLoaded, setCrackedImagesLoaded] = useState(false);
    const [backgroundTile4Ready, setBackgroundTile4Ready] = useState(false);

    // Keep renderState dimensions in sync
    useEffect(() => {
      renderState.width = width;
      renderState.height = height;
    }, [width, height]);

    // Load all image assets on mount
    useEffect(() => {
      const assets = assetsRef.current;
      let cancelled = false;

      // Power-up images
      Object.entries(powerUpImages).forEach(([type, src]) => {
       if (!src) return;
       const img = new Image();
        img.src = src;
       waitForImageDecode(img).finally(() => {
         if (!cancelled) {
           assets.powerUpImages[type] = img;
         }
       });
      });

      // Bonus letter images
      Object.entries(bonusLetterImages).forEach(([type, src]) => {
       const img = new Image();
       img.src = src;
       waitForImageDecode(img).finally(() => {
         if (!cancelled) {
           assets.bonusLetterImages[type] = img;
         }
       });
      });

      // Paddle
      const paddleImage = new Image();
      paddleImage.src = paddleImg;
      waitForImageDecode(paddleImage).finally(() => {
       if (!cancelled) {
         assets.paddleImage = paddleImage;
       }
      });

      const paddleTurretsImage = new Image();
      paddleTurretsImage.src = paddleTurretsImg;
      waitForImageDecode(paddleTurretsImage).finally(() => {
       if (!cancelled) {
         assets.paddleTurretsImage = paddleTurretsImage;
       }
      });

      // Cracked bricks
      const cracked1 = new Image();
      const cracked2 = new Image();
      const cracked3 = new Image();
      cracked1.src = crackedBrick1;
      cracked2.src = crackedBrick2;
      cracked3.src = crackedBrick3;
      Promise.all([waitForImageDecode(cracked1), waitForImageDecode(cracked2), waitForImageDecode(cracked3)]).finally(() => {
       if (!cancelled) {
         brickRenderer.setCrackedImages(cracked1, cracked2, cracked3);
         brickRenderer.invalidate();
         setCrackedImagesLoaded(true);
       }
      });

      // Background tiles
      const loadBg = (src: string, key: BackgroundImageAssetKey) => {
       const img = new Image();
       img.src = src;
       waitForImageDecode(img).finally(() => {
         if (cancelled) return;

         assets[key] = img;

         if (key in backgroundPatternKeys) {
           const patternKey = backgroundPatternKeys[key as PatternBackgroundImageAssetKey];
           assets.patterns[patternKey] = null;
           if (key === "backgroundImage4") {
             setBackgroundTile4Ready(true);
           }
         }
       });
      };
      loadBg(backgroundTile4, "backgroundImage4");
      loadBg(backgroundTile69, "backgroundImage69");
      loadBg(backgroundTile1114, "backgroundImage1114");
      loadBg(backgroundTile1620, "backgroundImage1620");

      // Boss level backgrounds (fitted)
      loadBg(bossLevel5Bg, "bossLevel5Bg");
      loadBg(bossLevel10Bg, "bossLevel10Bg");
      loadBg(bossLevel15Bg, "bossLevel15Bg");
      loadBg(bossLevel20Bg, "bossLevel20Bg");

      // Mega boss sprite
      const megaBossImage = new Image();
      megaBossImage.src = megaBossSprite;
      waitForImageDecode(megaBossImage).finally(() => {
        if (!cancelled) {
          assets.megaBossImage = megaBossImage;
        }
      });

      // Missile
      const missileImage = new Image();
      missileImage.src = missileImg;
      waitForImageDecode(missileImage).finally(() => {
        if (!cancelled) {
          assets.missileImage = missileImage;
        }
      });

      return () => {
        cancelled = true;
      };
    }, []);

    // Initialize brick layer cache
    useEffect(() => {
      brickRenderer.initialize(width, height);
    }, [width, height]);

    // Force cache rebuild when cracked images load
    useEffect(() => {
      if (crackedImagesLoaded) {
        brickRenderer.invalidate();
      }
    }, [crackedImagesLoaded]);

    // Warm up gradient cache before the render loop starts so that the browser
    // compiles GPU shaders during init rather than during the first gameplay
    // frames.  This prevents the "30 FPS for 30-60 s then 60 FPS" stall seen
    // on integrated GPUs.  Use the same creation attributes as startRenderLoop
    // so that canvas.getContext() returns the identical context object both
    // here and inside the render loop, keeping the gradient cache intact.
    //
    // Also warm up offscreen canvas contexts for every sub-1.0 resolution scale
    // (potato 0.25, low 0.75, medium 0.8).  The browser compiles different GPU
    // pipelines per canvas format and size; touching them now prevents the same
    // 30 FPS first-frame stall when the render loop switches to a scaled path.
    useEffect(() => {
      const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;
      const assets = assetsRef.current;

      warmUpGradients(ctx);
      warmUpCanvasContexts(width, height);

      if (assets.backgroundImage4 && !assets.patterns.bg4) {
        const backgroundPattern = ctx.createPattern(assets.backgroundImage4, "repeat");
        if (backgroundPattern) {
          assets.patterns.bg4 = backgroundPattern;
        }
      }

      brickRenderer.initialize(width, height);
      if (world.bricks.length > 0) {
        const brickCacheKey = `${width}x${height}:${world.bricks.length}:${renderState.qualitySettings.level}:${crackedImagesLoaded}`;
        if (warmedBrickCacheKeyRef.current !== brickCacheKey) {
          brickRenderer.updateCache(world.bricks, renderState.qualitySettings);
          warmedBrickCacheKeyRef.current = brickCacheKey;
        }
      }
    }, [backgroundTile4Ready, crackedImagesLoaded, ref, width, height]);

    // Start/stop render loop
    useEffect(() => {
      const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
      if (!canvas) return;

      stopLoopRef.current = startRenderLoop(canvas, assetsRef.current);

      return () => {
        if (stopLoopRef.current) {
          stopLoopRef.current();
          stopLoopRef.current = null;
        }
      };
    }, [ref]);

    return (
      <canvas
        ref={ref}
        width={width}
        height={height}
        className="cursor-none"
        style={{ display: "block" }}
      />
    );
  },
);

GameCanvas.displayName = "GameCanvas";
