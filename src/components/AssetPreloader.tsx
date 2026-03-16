import { useState, useEffect, useRef, useCallback } from "react";
import { GAME_VERSION } from "@/constants/version";

// All image imports
import paddleImg from "@/assets/paddle.png";
import paddleTurretsImg from "@/assets/paddle-turrets.png";
import crackedBrick1 from "@/assets/brick-cracked-1.png";
import crackedBrick2 from "@/assets/brick-cracked-2.png";
import crackedBrick3 from "@/assets/brick-cracked-3.png";
import backgroundTile from "@/assets/background-tile.png";
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
import metalBallTexture from "@/assets/metal-ball-texture.png";
import endScreen from "@/assets/end-screen.png";

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

interface AssetEntry {
  type: "image" | "audio";
  url: string;
  message: string;
}

const ASSET_MANIFEST: AssetEntry[] = [
  // Paddle & core
  { type: "image", url: paddleImg, message: "Magnetizing paddle surface..." },
  { type: "image", url: paddleTurretsImg, message: "Mounting turret hardpoints..." },
  { type: "image", url: metalBallTexture, message: "Polishing chromium ball bearings..." },
  { type: "image", url: missileImg, message: "Arming micro-missile guidance chips..." },

  // Cracked bricks
  { type: "image", url: crackedBrick1, message: "Simulating brick fracture patterns [1/3]..." },
  { type: "image", url: crackedBrick2, message: "Simulating brick fracture patterns [2/3]..." },
  { type: "image", url: crackedBrick3, message: "Simulating brick fracture patterns [3/3]..." },

  // Backgrounds
  { type: "image", url: backgroundTile, message: "Rendering sector alpha tilemap..." },
  { type: "image", url: backgroundTile2, message: "Rendering sector beta tilemap..." },
  { type: "image", url: backgroundTile3, message: "Rendering sector gamma tilemap..." },
  { type: "image", url: backgroundTile4, message: "Rendering sector delta tilemap..." },
  { type: "image", url: backgroundTile69, message: "Unpacking deep-space parallax layers..." },
  { type: "image", url: backgroundTile1114, message: "Decompressing cave biome textures..." },
  { type: "image", url: backgroundTile1620, message: "Decrypting desert wasteland data..." },

  // Boss backgrounds
  { type: "image", url: bossLevel5Bg, message: "Scanning Cube boss lair architecture..." },
  { type: "image", url: bossLevel10Bg, message: "Mapping Sphere boss threat perimeter..." },
  { type: "image", url: bossLevel15Bg, message: "Infiltrating Pyramid boss stronghold..." },
  { type: "image", url: bossLevel20Bg, message: "Breaching Hexagon final fortress..." },
  { type: "image", url: megaBoss, message: "Analyzing mega-boss neural patterns..." },
  { type: "image", url: endScreen, message: "Preparing victory celebration protocol..." },

  // Power-ups
  { type: "image", url: powerupBarrier, message: "Charging barrier force field generator..." },
  { type: "image", url: powerupExtend, message: "Calibrating paddle width expander..." },
  { type: "image", url: powerupFireball, message: "Heating plasma fireball core to 9000K..." },
  { type: "image", url: powerupHoming, message: "Programming homing trajectory AI..." },
  { type: "image", url: powerupLife, message: "Cloning emergency backup lives..." },
  { type: "image", url: powerupMultiball, message: "Charging multiball quantum splitter..." },
  { type: "image", url: powerupReflect, message: "Aligning photon reflection matrix..." },
  { type: "image", url: powerupSecondchance, message: "Initializing second chance failsafe..." },
  { type: "image", url: powerupShield, message: "Deploying electromagnetic shield array..." },
  { type: "image", url: powerupShrink, message: "Reversing polarity on shrink ray..." },
  { type: "image", url: powerupSlowdown, message: "Dilating local spacetime field..." },
  { type: "image", url: powerupStunner, message: "Tuning stunner EMP frequency..." },
  { type: "image", url: powerupTurrets, message: "Auto-calibrating turret targeting system..." },

  // Bonus letters
  { type: "image", url: bonusA, message: 'Encoding bonus glyph "A"...' },
  { type: "image", url: bonusR, message: 'Encoding bonus glyph "R"...' },
  { type: "image", url: bonusQ, message: 'Encoding bonus glyph "Q"...' },
  { type: "image", url: bonusN, message: 'Encoding bonus glyph "N"...' },
  { type: "image", url: bonusU, message: 'Encoding bonus glyph "U"...' },
  { type: "image", url: bonusM, message: 'Encoding bonus glyph "M"...' },

  // SFX
  { type: "audio", url: "/multiball.mp3", message: "Buffering multiball split waveform..." },
  { type: "audio", url: "/turrets.mp3", message: "Sampling turret burst audio..." },
  { type: "audio", url: "/fireball.mp3", message: "Recording plasma ignition samples..." },
  { type: "audio", url: "/extra_life.mp3", message: "Synthesizing 1-UP fanfare..." },
  { type: "audio", url: "/slower.mp3", message: "Time-stretching slowdown chime..." },
  { type: "audio", url: "/wider.mp3", message: "Widening paddle resonance tone..." },
  { type: "audio", url: "/smaller.mp3", message: "Compressing shrink alert beep..." },
  { type: "audio", url: "/shield.mp3", message: "Modulating shield activation hum..." },
  { type: "audio", url: "/barrier.mp3", message: "Generating barrier deployment sound..." },
  { type: "audio", url: "/cannon_mode.mp3", message: "Loading cannon mode klaxon..." },
  { type: "audio", url: "/stun.mp3", message: "Buffering stun discharge crackle..." },
  { type: "audio", url: "/reflecting.mp3", message: "Sampling reflection ping..." },
  { type: "audio", url: "/magnet.mp3", message: "Capturing magnetic lock tone..." },
  { type: "audio", url: "/ball_missed.mp3", message: "Caching ball-lost despair sound..." },
  { type: "audio", url: "/shrink.mp3", message: "Encoding paddle shrink alert..." },
  { type: "audio", url: "/High_score.mp3", message: "Preparing high-score celebration loop..." },

  // Music tracks
  { type: "audio", url: "/Pixel_Frenzy-2.mp3", message: "Decoding chiptune: Pixel Frenzy..." },
  { type: "audio", url: "/sound_2.mp3", message: "Decompressing chiptune: Track 02..." },
  { type: "audio", url: "/level_3.mp3", message: "Unpacking synthwave: Level 3..." },
  { type: "audio", url: "/level_4.mp3", message: "Remixing chiptune: Level 4..." },
  { type: "audio", url: "/level_5.mp3", message: "Decrypting frequency matrix: Level 5..." },
  { type: "audio", url: "/level_7.mp3", message: "Assembling waveforms: Level 7..." },
  { type: "audio", url: "/Turrican.mp3", message: "Channeling Turrican energy..." },
  { type: "audio", url: "/Flubber_Happy_Moderate_Amiga.mp3", message: "Restoring Amiga MOD tracker data..." },
  { type: "audio", url: "/leve_boss_chip_atari.mp3", message: "Extracting Atari boss chip melody..." },
  { type: "audio", url: "/level_cave_c64.mp3", message: "Loading C64 SID cave theme..." },
  { type: "audio", url: "/level_cave_2_c64.mp3", message: "Loading C64 SID cave theme II..." },
  { type: "audio", url: "/level_cave_chip_atari.mp3", message: "Processing Atari cave chip data..." },
  { type: "audio", url: "/level_cave_chip_atari_2.mp3", message: "Processing Atari cave chip data II..." },
  { type: "audio", url: "/level_dessert_chip_atari_2.mp3", message: "Decoding desert wasteland OST..." },
  { type: "audio", url: "/level_dessert_chip_atari_2_2.mp3", message: "Decoding desert wasteland OST II..." },

  // Boss music
  { type: "audio", url: "/Boss_level_cube.mp3", message: "Loading Cube boss battle anthem..." },
  { type: "audio", url: "/Boss_level_sphere.mp3", message: "Loading Sphere boss battle anthem..." },
  { type: "audio", url: "/Boss_level_pyramid.mp3", message: "Loading Pyramid boss battle anthem..." },
  { type: "audio", url: "/Boss_level_Hexagon.mp3", message: "Loading Hexagon boss battle anthem..." },
  { type: "audio", url: "/siren-alarm-boss.ogg", message: "Priming boss alarm siren..." },
];

const BOOT_MESSAGES = [
  "ARKANOID OS v4.20 — INITIALIZING",
  "Checking paddle integrity... OK",
  "Brick matrix memory allocated: 640K (should be enough)",
  "CRT phosphor warmup cycle started...",
  "",
];

const FINAL_MESSAGES = [
  "",
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  "  ALL SYSTEMS NOMINAL",
  "  READY TO ENGAGE",
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
];

interface AssetPreloaderProps {
  onComplete: () => void;
}

const AssetPreloader = ({ onComplete }: AssetPreloaderProps) => {
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [phase, setPhase] = useState<"boot" | "loading" | "done">("boot");
  const logEndRef = useRef<HTMLDivElement>(null);
  const totalAssets = ASSET_MANIFEST.length;

  const addLogLine = useCallback((line: string) => {
    setLogLines((prev) => [...prev, line]);
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logLines]);

  // Boot sequence
  useEffect(() => {
    let i = 0;
    const bootInterval = setInterval(() => {
      if (i < BOOT_MESSAGES.length) {
        addLogLine(BOOT_MESSAGES[i]);
        i++;
      } else {
        clearInterval(bootInterval);
        setPhase("loading");
      }
    }, 200);
    return () => clearInterval(bootInterval);
  }, [addLogLine]);

  // Asset loading
  useEffect(() => {
    if (phase !== "loading") return;

    let loaded = 0;
    let cancelled = false;

    const loadAsset = async (entry: AssetEntry) => {
      return new Promise<void>((resolve) => {
        if (entry.type === "image") {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Don't block on failures
          img.src = entry.url;
        } else {
          // For audio, just do a HEAD fetch to prime the cache
          fetch(entry.url, { method: "HEAD" })
            .then(() => resolve())
            .catch(() => resolve());
        }
      });
    };

    // Load assets in small batches for visible progress
    const loadSequentially = async () => {
      for (const entry of ASSET_MANIFEST) {
        if (cancelled) return;
        addLogLine(`> ${entry.message}`);
        await loadAsset(entry);
        loaded++;
        if (!cancelled) {
          setProgress(Math.round((loaded / totalAssets) * 100));
          addLogLine(`  ✓ done`);
        }
      }

      if (!cancelled) {
        // Show final messages
        for (const msg of FINAL_MESSAGES) {
          addLogLine(msg);
          await new Promise((r) => setTimeout(r, 120));
        }
        setPhase("done");
        setTimeout(onComplete, 800);
      }
    };

    loadSequentially();
    return () => { cancelled = true; };
  }, [phase, addLogLine, totalAssets, onComplete]);

  const filledBlocks = Math.round((progress / 100) * 20);
  const progressBar =
    "█".repeat(filledBlocks) + "░".repeat(20 - filledBlocks);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ backgroundColor: "hsl(220 20% 4%)" }}
    >
      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
        }}
      />

      <div className="relative z-10 w-full max-w-xl px-4 flex flex-col gap-4">
        {/* Header */}
        <div
          className="text-center font-mono text-xs tracking-widest uppercase"
          style={{ color: "hsl(142 70% 50%)" }}
        >
          ◆ VIBING ARKANOID — SYSTEM BOOT ◆
        </div>

        {/* Terminal log */}
        <div
          className="font-mono text-xs leading-relaxed overflow-y-auto custom-scrollbar rounded"
          style={{
            height: "280px",
            backgroundColor: "hsl(220 20% 7%)",
            border: "1px solid hsl(142 50% 25%)",
            padding: "12px",
            color: "hsl(142 60% 60%)",
          }}
        >
          {logLines.map((line, i) => (
            <div
              key={i}
              style={{
                color: line.startsWith("  ✓")
                  ? "hsl(142 70% 45%)"
                  : line.startsWith(">")
                  ? "hsl(45 80% 65%)"
                  : line.includes("━") || line.includes("NOMINAL") || line.includes("ENGAGE")
                  ? "hsl(0 0% 100%)"
                  : "hsl(142 50% 55%)",
                textShadow: line.includes("NOMINAL")
                  ? "0 0 8px hsl(142 80% 60%)"
                  : undefined,
              }}
            >
              {line || "\u00A0"}
            </div>
          ))}
          <div ref={logEndRef} />
          {phase === "loading" && (
            <span
              className="inline-block animate-pulse"
              style={{ color: "hsl(142 70% 50%)" }}
            >
              █
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="font-mono text-xs" style={{ color: "hsl(45 80% 65%)" }}>
          <div className="flex items-center gap-2">
            <span style={{ color: "hsl(142 50% 55%)" }}>[</span>
            <span
              style={{
                color:
                  phase === "done"
                    ? "hsl(142 80% 55%)"
                    : "hsl(45 80% 60%)",
                letterSpacing: "1px",
                textShadow:
                  phase === "done"
                    ? "0 0 6px hsl(142 80% 55%)"
                    : undefined,
                transition: "color 0.3s, text-shadow 0.3s",
              }}
            >
              {progressBar}
            </span>
            <span style={{ color: "hsl(142 50% 55%)" }}>]</span>
            <span className="ml-1 tabular-nums" style={{ color: "hsl(0 0% 80%)" }}>
              {progress}%
            </span>
          </div>
        </div>

        {/* Asset count */}
        <div
          className="font-mono text-center"
          style={{
            fontSize: "10px",
            color: "hsl(220 10% 45%)",
          }}
        >
          {Math.round((progress / 100) * totalAssets)}/{totalAssets} assets loaded
        </div>

        {/* Skip hint */}
        {phase !== "done" && (
          <div
            className="font-mono text-center cursor-pointer hover:underline"
            style={{
              fontSize: "10px",
              color: "hsl(220 10% 35%)",
            }}
            onClick={onComplete}
          >
            [PRESS TO SKIP]
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetPreloader;
