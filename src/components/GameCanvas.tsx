import { forwardRef, useEffect, useRef, useState } from "react";
import { renderState, createAssetRefs, type AssetRefs } from "@/engine/renderState";
import { startRenderLoop } from "@/engine/renderLoop";
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

export const GameCanvas = forwardRef<HTMLCanvasElement, GameCanvasProps>(
  ({ width, height }, ref) => {
    const assetsRef = useRef<AssetRefs>(createAssetRefs());
    const stopLoopRef = useRef<(() => void) | null>(null);
    const [crackedImagesLoaded, setCrackedImagesLoaded] = useState(false);

    // Keep renderState dimensions in sync
    useEffect(() => {
      renderState.width = width;
      renderState.height = height;
    }, [width, height]);

    // Load all image assets on mount
    useEffect(() => {
      const assets = assetsRef.current;

      // Power-up images
      Object.entries(powerUpImages).forEach(([type, src]) => {
        if (!src) return;
        const img = new Image();
        img.onload = () => { assets.powerUpImages[type] = img; };
        img.src = src;
      });

      // Bonus letter images
      Object.entries(bonusLetterImages).forEach(([type, src]) => {
        const img = new Image();
        img.onload = () => { assets.bonusLetterImages[type] = img; };
        img.src = src;
      });

      // Paddle
      const paddleImage = new Image();
      paddleImage.onload = () => { assets.paddleImage = paddleImage; };
      paddleImage.src = paddleImg;

      const paddleTurretsImage = new Image();
      paddleTurretsImage.onload = () => { assets.paddleTurretsImage = paddleTurretsImage; };
      paddleTurretsImage.src = paddleTurretsImg;

      // Cracked bricks
      const cracked1 = new Image();
      const cracked2 = new Image();
      const cracked3 = new Image();
      let loaded = 0;
      const checkAllCracked = () => {
        loaded++;
        if (loaded === 3) setCrackedImagesLoaded(true);
      };
      cracked1.onload = checkAllCracked;
      cracked2.onload = checkAllCracked;
      cracked3.onload = checkAllCracked;
      cracked1.src = crackedBrick1;
      cracked2.src = crackedBrick2;
      cracked3.src = crackedBrick3;

      // Store cracked refs for brick renderer
      const crackedInterval = setInterval(() => {
        if (cracked1.complete && cracked2.complete && cracked3.complete) {
          clearInterval(crackedInterval);
          brickRenderer.setCrackedImages(cracked1, cracked2, cracked3);
          brickRenderer.invalidate();
        }
      }, 100);

      // Background tiles
      const loadBg = (src: string, key: keyof AssetRefs) => {
        const img = new Image();
        img.onload = () => {
          (assets as any)[key] = img;
          // Invalidate cached pattern when new image loads
          assets.patterns = {};
        };
        img.src = src;
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
      megaBossImage.onload = () => { assets.megaBossImage = megaBossImage; };
      megaBossImage.src = megaBossSprite;

      // Missile
      const missileImage = new Image();
      missileImage.onload = () => { assets.missileImage = missileImage; };
      missileImage.src = missileImg;

      return () => clearInterval(crackedInterval);
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
