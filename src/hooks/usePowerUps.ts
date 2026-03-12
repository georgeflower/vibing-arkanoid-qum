import { useState, useCallback, useRef } from "react";
import type { PowerUp, PowerUpType, Ball, Paddle, Brick, Difficulty } from "@/types/game";
import { POWERUP_SIZE, POWERUP_FALL_SPEED, POWERUP_DROP_CHANCE, CANVAS_HEIGHT, CANVAS_WIDTH, PADDLE_WIDTH, FIREBALL_DURATION } from "@/constants/game";
import { debugToast as toast } from "@/utils/debugToast";
import { soundManager } from "@/utils/sounds";
import { powerUpPool, getNextPowerUpId } from "@/utils/entityPool";
import { world } from "@/engine/state";

const regularPowerUpTypes: PowerUpType[] = ["multiball", "turrets", "fireball", "life", "slowdown", "paddleExtend", "paddleShrink", "shield", "secondChance"];
const bossPowerUpTypes: PowerUpType[] = ["bossStunner", "reflectShield", "homingBall"];

export const usePowerUps = (
  currentLevel: number,
  setLives: React.Dispatch<React.SetStateAction<number>>,
  timer: number = 0,
  difficulty: Difficulty = "normal",
  setBrickHitSpeedAccumulated?: React.Dispatch<React.SetStateAction<number>>,
  onPowerUpCollected?: (type: string) => void,
  powerUpAssignments?: Map<number, PowerUpType>, // Pre-assigned power-ups
  onBossStunner?: () => void,
  onReflectShield?: () => void,
  onHomingBall?: () => void,
  onFireballStart?: () => void,
  onFireballEnd?: () => void,
  onSecondChance?: () => void,
  dualChoiceAssignments?: Map<number, PowerUpType>, // Second power-up type for dual-choice bricks
) => {
  const [powerUps, _setPowerUps] = useState<PowerUp[]>([]);
  const [extraLifeUsedLevels, setExtraLifeUsedLevels] = useState<number[]>([]);

  // Wrap setPowerUps to always keep world.powerUps in sync (race condition fix)
  const setPowerUps = useCallback((updater: PowerUp[] | ((prev: PowerUp[]) => PowerUp[])) => {
    _setPowerUps(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      world.powerUps = next;
      return next;
    });
  }, []);
  const fireballTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createPowerUp = useCallback((brick: Brick, isBossMinion: boolean = false, forceBossPowerUp: boolean = false, timeScale: number = 1.0): PowerUp | PowerUp[] | null => {
    const isEnemyDrop = brick.id < 0; // Enemies use fakeBricks with id: -1
    
    // Boss minions: 50% chance to drop power-up (or forced drop)
    if (isBossMinion && (forceBossPowerUp || Math.random() < 0.5)) {
      const isBossLevel = [5, 10, 15, 20].includes(currentLevel);
      const useBossPowerUp = forceBossPowerUp || (isBossLevel && Math.random() < 0.5);
      
      let availableTypes: PowerUpType[];
      if (useBossPowerUp) {
        availableTypes = [...bossPowerUpTypes];
      } else {
        availableTypes = [...regularPowerUpTypes];
        if (difficulty === "godlike") {
          availableTypes = availableTypes.filter(t => t !== "life");
        } else {
          const levelGroup = Math.floor(currentLevel / 5);
          if (extraLifeUsedLevels.includes(levelGroup)) {
            availableTypes = availableTypes.filter(t => t !== "life");
          }
        }
      }

      const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      return powerUpPool.acquire({
        id: getNextPowerUpId(),
        x: brick.x + brick.width / 2 - POWERUP_SIZE / 2,
        y: brick.y,
        width: POWERUP_SIZE,
        height: POWERUP_SIZE,
        type,
        speed: POWERUP_FALL_SPEED * timeScale,
        active: true,
      });
    }
    
    // Regular enemy drops (non-boss minions)
    if (isEnemyDrop) {
      let availableTypes = [...regularPowerUpTypes];
      if (difficulty === "godlike") {
        availableTypes = availableTypes.filter(t => t !== "life");
      } else {
        const levelGroup = Math.floor(currentLevel / 5);
        if (extraLifeUsedLevels.includes(levelGroup)) {
          availableTypes = availableTypes.filter(t => t !== "life");
        }
      }
      const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      return powerUpPool.acquire({
        id: getNextPowerUpId(),
        x: brick.x + brick.width / 2 - POWERUP_SIZE / 2,
        y: brick.y,
        width: POWERUP_SIZE,
        height: POWERUP_SIZE,
        type,
        speed: POWERUP_FALL_SPEED * timeScale,
        active: true,
      });
    }
    
    // Regular bricks: use pre-assigned power-ups
    if (!powerUpAssignments) return null;
    
    const assignedType = powerUpAssignments.get(brick.id);
    if (!assignedType) return null;

    // Check if this brick has a dual-choice assignment
    const secondType = dualChoiceAssignments?.get(brick.id);
    if (secondType) {
      const id1 = getNextPowerUpId();
      const id2 = getNextPowerUpId();
      const centerX = brick.x + brick.width / 2;
      const gap = PADDLE_WIDTH * 1.75; // 1.75 paddle widths between power-ups
      const halfGap = gap / 2;

      // Default positions: centered with gap
      let x1 = centerX - halfGap - POWERUP_SIZE / 2;
      let x2 = centerX + halfGap - POWERUP_SIZE / 2;

      // Wall-clamp: if left power-up goes off-screen, shift both right
      if (x1 < 0) {
        x1 = 0;
        x2 = x1 + gap;
      }
      // If right power-up goes off-screen, shift both left
      if (x2 + POWERUP_SIZE > CANVAS_WIDTH) {
        x2 = CANVAS_WIDTH - POWERUP_SIZE;
        x1 = x2 - gap;
      }

      const pu1 = powerUpPool.acquire({
        id: id1,
        x: x1,
        y: brick.y,
        width: POWERUP_SIZE,
        height: POWERUP_SIZE,
        type: assignedType,
        speed: POWERUP_FALL_SPEED * timeScale,
        active: true,
        pairedWithId: id2,
        isDualChoice: true,
      });
      const pu2 = powerUpPool.acquire({
        id: id2,
        x: x2,
        y: brick.y,
        width: POWERUP_SIZE,
        height: POWERUP_SIZE,
        type: secondType,
        speed: POWERUP_FALL_SPEED * timeScale,
        active: true,
        pairedWithId: id1,
        isDualChoice: true,
      });
      return [pu1, pu2];
    }

    return powerUpPool.acquire({
      id: getNextPowerUpId(),
      x: brick.x + brick.width / 2 - POWERUP_SIZE / 2,
      y: brick.y,
      width: POWERUP_SIZE,
      height: POWERUP_SIZE,
      type: assignedType,
      speed: POWERUP_FALL_SPEED * timeScale,
      active: true,
    });
  }, [currentLevel, extraLifeUsedLevels, difficulty, powerUpAssignments, dualChoiceAssignments]);

  const updatePowerUps = useCallback((deltaTimeSeconds: number) => {
    setPowerUps(prev => {
      // In-place mutation: update positions
      for (let i = prev.length - 1; i >= 0; i--) {
        const p = prev[i];
        p.y += p.speed * deltaTimeSeconds * 60; // scale by normalized dt (speed is in pixels/60fps-frame)
        
        // Release back to pool if off-screen or inactive
        if (p.y >= CANVAS_HEIGHT || !p.active) {
          // Release pooled power-ups (they have id from pool acquisition)
          powerUpPool.release(p as PowerUp & { id: number });
          // Swap-and-pop removal
          const last = prev.length - 1;
          if (i !== last) {
            prev[i] = prev[last];
          }
          prev.pop();
        }
      }
      // Sync to world singleton so the renderer reads consistent data (race condition fix)
      world.powerUps = prev;
      return prev; // Return same reference — renderer reads world.powerUps directly
    });
  }, []);

  const checkPowerUpCollision = useCallback((
    paddle: Paddle,
    balls: Ball[],
    setBalls: React.Dispatch<React.SetStateAction<Ball[]>>,
    setPaddle: React.Dispatch<React.SetStateAction<Paddle | null>>,
    setSpeedMultiplier: React.Dispatch<React.SetStateAction<number>>
  ) => {
    setPowerUps(prev => {
      // First pass: find which power-ups are caught and collect paired IDs to deactivate
      const caughtPairedIds = new Set<number>();
      
      const result = prev.map(powerUp => {
        // Skip already deactivated or paired-deactivated power-ups
        if (!powerUp.active || caughtPairedIds.has(powerUp.id!)) {
          if (caughtPairedIds.has(powerUp.id!)) {
            return { ...powerUp, active: false };
          }
          return powerUp;
        }
        
        if (
          powerUp.x + powerUp.width > paddle.x &&
          powerUp.x < paddle.x + paddle.width &&
          powerUp.y + powerUp.height > paddle.y &&
          powerUp.y < paddle.y + paddle.height
        ) {
          // If this is a dual-choice power-up, mark the paired one for deactivation
          if (powerUp.isDualChoice && powerUp.pairedWithId !== undefined) {
            caughtPairedIds.add(powerUp.pairedWithId);
          }
          
          // Apply power-up effect
          onPowerUpCollected?.(powerUp.type);
          
          switch (powerUp.type) {
            // ... keep existing code
            case "multiball":
              soundManager.playMultiballSound();
              if (balls.length > 0) {
                const baseBall = balls[0];
                const newBalls: Ball[] = [
                  { ...baseBall, id: Date.now() + 1, dx: baseBall.dx - 2, rotation: Math.random() * 360 },
                  { ...baseBall, id: Date.now() + 2, dx: baseBall.dx + 2, rotation: Math.random() * 360 },
                ];
                setBalls(prev => [...prev, ...newBalls]);
                toast.success("Multi-ball activated!");
              }
              break;
            
            case "turrets":
              soundManager.playTurretsSound();
              const shotsCount = difficulty === "godlike" ? 15 : 30;
              const maxShots = 45;
              setPaddle(prev => {
                if (!prev) return null;
                if (prev.hasTurrets && (prev.turretShots || 0) > 0) {
                  const newShots = Math.min((prev.turretShots || 0) + shotsCount, maxShots);
                  toast.success(`Super Turrets! (${newShots} shots)`);
                  return { ...prev, turretShots: newShots, hasSuperTurrets: true };
                }
                toast.success(`Turrets activated! (${shotsCount} shots)`);
                return { ...prev, hasTurrets: true, turretShots: shotsCount, hasSuperTurrets: false };
              });
              break;
            
            case "fireball":
              soundManager.playFireballSound();
              setBalls(prev => prev.map(ball => ({ ...ball, isFireball: true })));
              if (fireballTimeoutRef.current) {
                clearTimeout(fireballTimeoutRef.current);
              }
              onFireballStart?.();
              fireballTimeoutRef.current = setTimeout(() => {
                setBalls(prev => prev.map(ball => ({ ...ball, isFireball: false })));
                fireballTimeoutRef.current = null;
                onFireballEnd?.();
              }, FIREBALL_DURATION);
              toast.success("Fireball activated!");
              break;
            
            case "life":
              if (powerUp.isMercyLife) {
                soundManager.playExtraLifeSound();
                setLives(prev => prev + 1);
                toast.success("Mercy Extra Life!");
              } else {
                const levelGroup = Math.floor(currentLevel / 5);
                if (!extraLifeUsedLevels.includes(levelGroup)) {
                  soundManager.playExtraLifeSound();
                  setLives(prev => prev + 1);
                  setExtraLifeUsedLevels(prev => [...prev, levelGroup]);
                  toast.success("Extra life!");
                } else {
                  console.warn("[Power-Up] Extra life collected but already used for this level group");
                }
              }
              break;
            
            case "slowdown":
              soundManager.playSlowerSound();
              setSpeedMultiplier(prev => {
                const newSpeed = Math.max(0.9, prev - 0.1);
                setBalls(prevBalls => prevBalls.map(ball => {
                  const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                  const newBallSpeed = currentSpeed * (newSpeed / prev);
                  const angle = Math.atan2(ball.dx, -ball.dy);
                  return {
                    ...ball,
                    speed: newBallSpeed,
                    dx: newBallSpeed * Math.sin(angle),
                    dy: -newBallSpeed * Math.cos(angle),
                  };
                }));
                return newSpeed;
              });
              if (setBrickHitSpeedAccumulated) {
                setBrickHitSpeedAccumulated(0);
              }
              toast.success("Speed reduced by 10%!");
              break;
            
            case "paddleExtend":
              soundManager.playWiderSound();
              setPaddle(prev => prev ? { ...prev, width: Math.min(200, prev.width + 30) } : null);
              toast.success("Paddle extended!");
              break;
            
            case "paddleShrink":
              soundManager.playShrinkSound();
              setPaddle(prev => prev ? { ...prev, width: Math.max(60, prev.width - 30) } : null);
              toast.success("Paddle shrunk!");
              break;
            
            case "shield":
              soundManager.playShieldSound();
              setPaddle(prev => prev ? { ...prev, hasShield: true } : null);
              toast.success("Shield activated!");
              break;
            
            case "bossStunner":
              soundManager.playBossStunnerSound();
              onBossStunner?.();
              toast.success("Boss Stunner! Boss frozen for 5 seconds!");
              break;

            case "reflectShield":
              soundManager.playReflectShieldSound();
              onReflectShield?.();
              toast.success("Reflect Shield! Boss attacks reflected for 15 seconds!");
              break;

            case "homingBall":
              soundManager.playHomingBallSound();
              onHomingBall?.();
              toast.success("Magnet! Ball seeks the boss for 8 seconds!");
              break;

            case "secondChance":
              soundManager.playSecondChanceSound();
              setPaddle(prev => prev ? { ...prev, hasSecondChance: true } : null);
              onSecondChance?.();
              toast.success("Second Chance! Safety net activated!");
              break;
          }

          return { ...powerUp, active: false };
        }
        return powerUp;
      });
      
      // Second pass: deactivate any paired power-ups that weren't already handled
      if (caughtPairedIds.size > 0) {
        return result.map(pu => {
          if (pu.active && pu.id !== undefined && caughtPairedIds.has(pu.id)) {
            return { ...pu, active: false };
          }
          return pu;
        });
      }
      
      return result;
    });
  }, [currentLevel, extraLifeUsedLevels, setLives, onBossStunner, onReflectShield, onHomingBall, onSecondChance]);

  return {
    powerUps,
    setPowerUps,
    createPowerUp,
    updatePowerUps,
    checkPowerUpCollision,
    extraLifeUsedLevels, // Export for power-up assignment system
  };
};
