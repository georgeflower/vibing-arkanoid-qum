import { useCallback } from "react";
import type { Bullet, Paddle, Brick, Boss } from "@/types/game";
import { BULLET_WIDTH, BULLET_HEIGHT, BULLET_SPEED, CANVAS_HEIGHT, BRICK_PADDING } from "@/constants/game";
import { soundManager } from "@/utils/sounds";
import { getHitColor } from "@/constants/game";
import { toast } from "sonner";
import { isMegaBoss, handleMegaBossOuterDamage, exposeMegaBossCore, MegaBoss } from "@/utils/megaBossUtils";
import { bulletPool, getNextBulletId } from "@/utils/entityPool";
import { world } from "@/engine/state";

// ─── Bullet-boss hit event (consumed by Game.tsx) ────────────
export interface BulletBossHitEvent {
  bossId: number;
  damage: number;
  x: number;
  y: number;
  isSuper: boolean;
  isResurrected: boolean;
  resurrectedIndex: number; // -1 for main boss
}

// Shared array — written by updateBullets, drained by Game.tsx each frame
export const pendingBulletBossHits: BulletBossHitEvent[] = [];

export const useBullets = (
  setScore: React.Dispatch<React.SetStateAction<number>>,
  setBricks: React.Dispatch<React.SetStateAction<Brick[]>>,
  bricks: Brick[],
  setPaddle: React.Dispatch<React.SetStateAction<Paddle | null>>,
  onBrickDestroyedByTurret?: () => void,
  onLevelComplete?: () => void,
  onTurretDepleted?: () => void,
  onBossHit?: (x: number, y: number, isSuper: boolean) => void
) => {
  const fireBullets = useCallback((paddle: Paddle) => {
    if (!paddle.hasTurrets || !paddle.turretShots || paddle.turretShots <= 0) return;

    soundManager.playShoot();

    const isSuper = paddle.hasSuperTurrets || false;

    const leftBullet = bulletPool.acquire({
      id: getNextBulletId(),
      x: paddle.x + 10,
      y: paddle.y,
      width: BULLET_WIDTH,
      height: BULLET_HEIGHT,
      speed: BULLET_SPEED,
      isSuper,
      isBounced: false,
    });

    const rightBullet = bulletPool.acquire({
      id: getNextBulletId(),
      x: paddle.x + paddle.width - 10 - BULLET_WIDTH,
      y: paddle.y,
      width: BULLET_WIDTH,
      height: BULLET_HEIGHT,
      speed: BULLET_SPEED,
      isSuper,
      isBounced: false,
    });

    // Push directly to world.bullets — no React state involved
    if (leftBullet) world.bullets.push(leftBullet);
    if (rightBullet) world.bullets.push(rightBullet);

    // Decrement turret shots and remove turrets if depleted
    setPaddle(prev => {
      if (!prev) return null;
      const newShots = (prev.turretShots || 0) - 1;
      if (newShots <= 0) {
        onTurretDepleted?.();
        return { ...prev, hasTurrets: false, turretShots: 0 };
      }
      return { ...prev, turretShots: newShots };
    });
  }, [setPaddle, onTurretDepleted]);

  const updateBullets = useCallback((currentBricks: Brick[], deltaTimeSeconds: number) => {
    // ── Live reads from world (no stale closures) ──
    const enemies = world.enemies;
    const boss = world.boss;
    const resurrectedBosses = world.resurrectedBosses;

    const prev = world.bullets;

    // In-place mutation: update positions
    for (let i = 0; i < prev.length; i++) {
      const b = prev[i];
      const move = b.speed * deltaTimeSeconds * 60;
      b.y = b.isBounced ? b.y + move : b.y - move;
    }

    // Filter out-of-bounds bullets and release to pool
    let movedBullets = prev;
    let hasOutOfBounds = false;
    for (let i = 0; i < prev.length; i++) {
      if (prev[i].y <= 0 || prev[i].y >= CANVAS_HEIGHT) {
        hasOutOfBounds = true;
        break;
      }
    }

    if (hasOutOfBounds) {
      movedBullets = [];
      for (let i = 0; i < prev.length; i++) {
        const b = prev[i];
        if (b.y > 0 && b.y < CANVAS_HEIGHT) {
          movedBullets.push(b);
        } else {
          bulletPool.release(b as Bullet & { id: number });
        }
      }
    }

    const bulletIndicesHit = new Set<number>();
    const bulletIndicesToBounce = new Set<number>();
    const brickIndicesToDestroy = new Set<number>();

    // Check enemy collisions first (only for bullets going up)
    for (let bulletIdx = 0; bulletIdx < movedBullets.length; bulletIdx++) {
      const bullet = movedBullets[bulletIdx];
      if (bulletIndicesHit.has(bulletIdx) || bullet.isBounced) continue;

      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (
          bulletIndicesHit.has(bulletIdx) ||
          bullet.x + bullet.width <= enemy.x ||
          bullet.x >= enemy.x + enemy.width ||
          bullet.y >= enemy.y + enemy.height ||
          bullet.y + bullet.height <= enemy.y
        ) {
          continue;
        }

        bulletIndicesToBounce.add(bulletIdx);
        soundManager.playBounce();
      }
    }

    // Check boss collisions — push events to pendingBulletBossHits instead of setBoss
    if (boss || (resurrectedBosses && resurrectedBosses.length > 0)) {
      for (let bulletIdx = 0; bulletIdx < movedBullets.length; bulletIdx++) {
        const bullet = movedBullets[bulletIdx];
        if (bulletIndicesHit.has(bulletIdx) || bulletIndicesToBounce.has(bulletIdx) || bullet.isBounced) continue;

        if (boss) {
          if (
            bullet.x + bullet.width > boss.x &&
            bullet.x < boss.x + boss.width &&
            bullet.y < boss.y + boss.height &&
            bullet.y + bullet.height > boss.y
          ) {
            bulletIndicesHit.add(bulletIdx);
            const damage = bullet.isSuper ? 1 : 0.5;
            pendingBulletBossHits.push({
              bossId: boss.id,
              damage,
              x: bullet.x + bullet.width / 2,
              y: bullet.y,
              isSuper: bullet.isSuper || false,
              isResurrected: false,
              resurrectedIndex: -1,
            });
            onBossHit?.(bullet.x + bullet.width / 2, bullet.y, bullet.isSuper || false);
            soundManager.playBounce();
          }
        }

        if (resurrectedBosses) {
          for (let i = 0; i < resurrectedBosses.length; i++) {
            const resBoss = resurrectedBosses[i];
            if (bulletIndicesHit.has(bulletIdx)) break;

            if (
              bullet.x + bullet.width > resBoss.x &&
              bullet.x < resBoss.x + resBoss.width &&
              bullet.y < resBoss.y + resBoss.height &&
              bullet.y + bullet.height > resBoss.y
            ) {
              bulletIndicesHit.add(bulletIdx);
              const damage = bullet.isSuper ? 1 : 0.5;
              pendingBulletBossHits.push({
                bossId: resBoss.id,
                damage,
                x: bullet.x + bullet.width / 2,
                y: bullet.y,
                isSuper: bullet.isSuper || false,
                isResurrected: true,
                resurrectedIndex: i,
              });
              onBossHit?.(bullet.x + bullet.width / 2, bullet.y, bullet.isSuper || false);
              soundManager.playBounce();
            }
          }
        }
      }
    }

    // Check brick collisions (only for bullets going up)
    for (let bulletIdx = 0; bulletIdx < movedBullets.length; bulletIdx++) {
      const bullet = movedBullets[bulletIdx];
      if (bulletIndicesHit.has(bulletIdx) || bulletIndicesToBounce.has(bulletIdx) || bullet.isBounced) continue;

      for (let brickIdx = 0; brickIdx < currentBricks.length; brickIdx++) {
        const brick = currentBricks[brickIdx];
        const collisionX = brick.x - BRICK_PADDING / 2;
        const collisionY = brick.y - BRICK_PADDING / 2;
        const collisionWidth = brick.width + BRICK_PADDING;
        const collisionHeight = brick.height + BRICK_PADDING;

        if (
          bulletIndicesHit.has(bulletIdx) ||
          brickIndicesToDestroy.has(brickIdx) ||
          !brick.visible ||
          bullet.x + bullet.width <= collisionX ||
          bullet.x >= collisionX + collisionWidth ||
          bullet.y >= collisionY + collisionHeight ||
          bullet.y + bullet.height <= collisionY
        ) {
          continue;
        }

        if (brick.isIndestructible) {
          if (bullet.isSuper) {
            bulletIndicesHit.add(bulletIdx);
            brickIndicesToDestroy.add(brickIdx);
          } else {
            bulletIndicesHit.add(bulletIdx);
            soundManager.playBounce();
          }
        } else {
          bulletIndicesHit.add(bulletIdx);
          brickIndicesToDestroy.add(brickIdx);
        }
      }
    }

    // Update bricks if any collisions occurred
    if (brickIndicesToDestroy.size > 0) {
      setBricks(prevBricks => {
        const updatedBricks = prevBricks.map((brick, idx) => {
          if (brickIndicesToDestroy.has(idx)) {
            soundManager.playBrickHit(brick.type, brick.hitsRemaining);
            const updatedBrick = { ...brick, hitsRemaining: brick.hitsRemaining - 1 };

            if (updatedBrick.hitsRemaining > 0) {
              updatedBrick.color = getHitColor(brick.color, updatedBrick.hitsRemaining, brick.maxHits);
            } else {
              updatedBrick.visible = false;
              setScore(prev => prev + brick.points);
              onBrickDestroyedByTurret?.();
            }

            return updatedBrick;
          }
          return brick;
        });

        return updatedBricks;
      });

      const remainingBricks = currentBricks.filter((b, idx) => {
        const wasDestroyed = brickIndicesToDestroy.has(idx);
        if (wasDestroyed) {
          const newHits = b.hitsRemaining - 1;
          return newHits > 0 && !b.isIndestructible;
        }
        return b.visible && !b.isIndestructible;
      });
      if (remainingBricks.length === 0) {
        onLevelComplete?.();
      }
    }

    // Build final array: bounce enemies, remove hits, write to world
    if (bulletIndicesHit.size === 0 && bulletIndicesToBounce.size === 0) {
      world.bullets = movedBullets;
      return;
    }

    const result: Bullet[] = [];
    for (let i = 0; i < movedBullets.length; i++) {
      if (bulletIndicesHit.has(i)) {
        bulletPool.release(movedBullets[i] as Bullet & { id: number });
        continue;
      }
      const bullet = movedBullets[i];
      if (bulletIndicesToBounce.has(i)) {
        bullet.isBounced = true;
      }
      result.push(bullet);
    }
    world.bullets = result;
  }, [setBricks, setScore, onLevelComplete, onBossHit, onBrickDestroyedByTurret]);

  return {
    fireBullets,
    updateBullets,
  };
};
