import { useState, useEffect, useRef, useCallback } from "react";
import { GAME_VERSION } from "@/constants/version";

// All image imports - ordered by priority
import paddleImg from "@/assets/paddle.png";
import paddleTurretsImg from "@/assets/paddle-turrets.png";
import metalBallTexture from "@/assets/metal-ball-texture.png";
import crackedBrick1 from "@/assets/brick-cracked-1.png";
import crackedBrick2 from "@/assets/brick-cracked-2.png";
import crackedBrick3 from "@/assets/brick-cracked-3.png";
import backgroundTile from "@/assets/background-tile.png";

// Power-up images
import powerupBarrier from "@/assets/powerup-barrier.png";
import powerupExtend from "@/assets/powerup-extend.png";
import powerupFireball from "@/assets/powerup-fireball.png";
import powerupHoming from "@/assets/powerup-homing.png";
import powerupLife from "@/assets/powerup-life.png";
import powerupMultiball from "@/assets/powerup-multiball.png";
import powerupReflect from "@/assets/powerup-reflect.png";
import powerupSecondchance from "@/assets/powerup-secondchance.png";
import powerupShield from "@/assets/powerup-shield.png";
import powerupShrink from "@/assets/powerup-shrink.png";
import powerupSlowdown from "@/assets/powerup-slowdown.png";
import powerupStunner from "@/assets/powerup-stunner.png";
import powerupTurrets from "@/assets/powerup-turrets.png";

// Bonus letter images
import bonusA from "@/assets/bonus-a.png";
import bonusM from "@/assets/bonus-m.png";
import bonusN from "@/assets/bonus-n.png";
import bonusQ from "@/assets/bonus-q.png";
import bonusR from "@/assets/bonus-r.png";
import bonusU from "@/assets/bonus-u.png";

// Later backgrounds & bosses
import backgroundTile2 from "@/assets/background-tile-2.png";
import backgroundTile3 from "@/assets/background-tile-3.png";
import backgroundTile4 from "@/assets/background-tile-4.png";
import backgroundTile69 from "@/assets/background-tile-6-9.png";
import backgroundTile1114 from "@/assets/background-tile-11-14.png";
import backgroundTile1620 from "@/assets/background-tile-16-20.png";
import bossLevel5Bg from "@/assets/boss-level-5-bg.png";
import bossLevel10Bg from "@/assets/boss-level-10-bg.png";
import bossLevel15Bg from "@/assets/boss-level-15-bg.png";
import bossLevel20Bg from "@/assets/boss-level-20-bg.png";
import megaBoss from "@/assets/mega-boss.png";
import missileImg from "@/assets/missile.png";
import endScreen from "@/assets/end-screen.png";

interface AssetEntry {
  type: "image" | "audio";
  url: string;
  priority: 1 | 2 | 3;
}

const ASSET_MANIFEST: AssetEntry[] = [
  // Priority 1: Level 1 essentials
  { type: "image", url: paddleImg, priority: 1 },
  { type: "image", url: paddleTurretsImg, priority: 1 },
  { type: "image", url: metalBallTexture, priority: 1 },
  { type: "image", url: crackedBrick1, priority: 1 },
  { type: "image", url: crackedBrick2, priority: 1 },
  { type: "image", url: crackedBrick3, priority: 1 },
  { type: "image", url: backgroundTile, priority: 1 },
  { type: "audio", url: "/ball_missed.mp3", priority: 1 },

  // Priority 2: Power-ups, bonus letters, common SFX
  { type: "image", url: powerupBarrier, priority: 2 },
  { type: "image", url: powerupExtend, priority: 2 },
  { type: "image", url: powerupFireball, priority: 2 },
  { type: "image", url: powerupHoming, priority: 2 },
  { type: "image", url: powerupLife, priority: 2 },
  { type: "image", url: powerupMultiball, priority: 2 },
  { type: "image", url: powerupReflect, priority: 2 },
  { type: "image", url: powerupSecondchance, priority: 2 },
  { type: "image", url: powerupShield, priority: 2 },
  { type: "image", url: powerupShrink, priority: 2 },
  { type: "image", url: powerupSlowdown, priority: 2 },
  { type: "image", url: powerupStunner, priority: 2 },
  { type: "image", url: powerupTurrets, priority: 2 },
  { type: "image", url: bonusA, priority: 2 },
  { type: "image", url: bonusR, priority: 2 },
  { type: "image", url: bonusQ, priority: 2 },
  { type: "image", url: bonusN, priority: 2 },
  { type: "image", url: bonusU, priority: 2 },
  { type: "image", url: bonusM, priority: 2 },
  { type: "audio", url: "/multiball.mp3", priority: 2 },
  { type: "audio", url: "/turrets.mp3", priority: 2 },
  { type: "audio", url: "/fireball.mp3", priority: 2 },
  { type: "audio", url: "/extra_life.mp3", priority: 2 },
  { type: "audio", url: "/slower.mp3", priority: 2 },
  { type: "audio", url: "/wider.mp3", priority: 2 },
  { type: "audio", url: "/smaller.mp3", priority: 2 },
  { type: "audio", url: "/shield.mp3", priority: 2 },
  { type: "audio", url: "/barrier.mp3", priority: 2 },
  { type: "audio", url: "/cannon_mode.mp3", priority: 2 },
  { type: "audio", url: "/stun.mp3", priority: 2 },
  { type: "audio", url: "/reflecting.mp3", priority: 2 },
  { type: "audio", url: "/magnet.mp3", priority: 2 },
  { type: "audio", url: "/shrink.mp3", priority: 2 },
  { type: "audio", url: "/High_score.mp3", priority: 2 },

  // Priority 3: Later backgrounds, bosses, end screen
  { type: "image", url: backgroundTile2, priority: 3 },
  { type: "image", url: backgroundTile3, priority: 3 },
  { type: "image", url: backgroundTile4, priority: 3 },
  { type: "image", url: backgroundTile69, priority: 3 },
  { type: "image", url: backgroundTile1114, priority: 3 },
  { type: "image", url: backgroundTile1620, priority: 3 },
  { type: "image", url: bossLevel5Bg, priority: 3 },
  { type: "image", url: bossLevel10Bg, priority: 3 },
  { type: "image", url: bossLevel15Bg, priority: 3 },
  { type: "image", url: bossLevel20Bg, priority: 3 },
  { type: "image", url: megaBoss, priority: 3 },
  { type: "image", url: missileImg, priority: 3 },
  { type: "image", url: endScreen, priority: 3 },
];

// Sort by priority
const SORTED_MANIFEST = [...ASSET_MANIFEST].sort((a, b) => a.priority - b.priority);

const loadAsset = (entry: AssetEntry): Promise<void> =>
  new Promise((resolve) => {
    if (entry.type === "image") {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = entry.url;
    } else {
      fetch(entry.url, { method: "HEAD" })
        .then(() => resolve())
        .catch(() => resolve());
    }
  });

export const useAssetPreloader = () => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const cancelledRef = useRef(false);
  const startedRef = useRef(false);

  const alreadyCached = localStorage.getItem("preloader_version") === GAME_VERSION;

  useEffect(() => {
    if (alreadyCached) {
      setProgress(100);
      setIsComplete(true);
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;
    cancelledRef.current = false;

    const total = SORTED_MANIFEST.length;
    let loaded = 0;

    const run = async () => {
      for (const entry of SORTED_MANIFEST) {
        if (cancelledRef.current) return;
        await loadAsset(entry);
        loaded++;
        if (!cancelledRef.current) {
          setProgress(Math.round((loaded / total) * 100));
        }
      }
      if (!cancelledRef.current) {
        setIsComplete(true);
        localStorage.setItem("preloader_version", GAME_VERSION);
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
    };
  }, [alreadyCached]);

  const isLoading = !alreadyCached && !isComplete;

  return { progress, isLoading, isComplete };
};
