/**
 * Generic Entity Pool for object reuse
 * Reduces GC pressure by reusing objects instead of creating/destroying them
 * 
 * OPTIMIZED: Uses Map for O(1) release lookups instead of O(n) indexOf
 */

export interface Poolable {
  active?: boolean;
  id?: number | string;
  [key: string]: any;
}

export class EntityPool<T extends Poolable> {
  private pool: T[] = [];
  private activeMap: Map<number | string, T> = new Map(); // O(1) lookup by ID
  private maxPoolSize: number;
  private factory: () => T;
  private resetFn: (obj: T) => void;
  
  // Cached active array - avoids Array.from() on every getActive() call
  private _cachedActive: T[] = [];
  private _cacheValid: boolean = false;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 50,
    maxSize: number = 200
  ) {
    this.factory = factory;
    this.resetFn = reset;
    this.maxPoolSize = maxSize;
    this.preallocate(initialSize);
  }

  private preallocate(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * Acquire an object from the pool, applying initialization properties
   * Returns null if pool is exhausted
   */
  acquire(init: Partial<T>): T | null {
    let obj: T;

    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else if (this.activeMap.size < this.maxPoolSize) {
      obj = this.factory();
    } else {
      return null; // Pool exhausted
    }

    // Apply initialization
    Object.assign(obj, init);
    obj.active = true;
    
    // Track by ID if available
    const id = obj.id;
    if (id !== undefined) {
      this.activeMap.set(id, obj);
    }
    
    // Invalidate cache since active set changed
    this._cacheValid = false;
    
    return obj;
  }

  /**
   * Release an object back to the pool using its ID
   * O(1) lookup via Map
   */
  release(obj: T): void {
    const id = obj.id;
    if (id !== undefined && this.activeMap.has(id)) {
      this.activeMap.delete(id);
      this.resetFn(obj);
      this.pool.push(obj);
      // Invalidate cache since active set changed
      this._cacheValid = false;
    }
  }

  /**
   * Release an object by its ID directly
   * Useful when you only have the ID, not the object reference
   */
  releaseById(id: number | string): void {
    const obj = this.activeMap.get(id);
    if (obj) {
      this.activeMap.delete(id);
      this.resetFn(obj);
      this.pool.push(obj);
      // Invalidate cache since active set changed
      this._cacheValid = false;
    }
  }

  /**
   * Get an active object by ID
   */
  getById(id: number | string): T | undefined {
    return this.activeMap.get(id);
  }

  /**
   * Check if an ID is currently active
   */
  hasId(id: number | string): boolean {
    return this.activeMap.has(id);
  }

  /**
   * Get array of currently active objects
   * Uses cached array to avoid Array.from() allocation on every call
   */
  getActive(): T[] {
    if (!this._cacheValid) {
      this._cachedActive.length = 0;
      this.activeMap.forEach(v => this._cachedActive.push(v));
      this._cacheValid = true;
    }
    return this._cachedActive;
  }

  /**
   * Release all active objects back to the pool
   * Must be called whenever bulk clearing React state (e.g., setEnemies([]))
   */
  releaseAll(): void {
    this.activeMap.forEach((obj) => {
      this.resetFn(obj);
      this.pool.push(obj);
    });
    this.activeMap.clear();
    // Invalidate cache since all active objects were released
    this._cacheValid = false;
  }

  /**
   * Get pool statistics for debugging
   */
  getStats(): { active: number; pooled: number } {
    return {
      active: this.activeMap.size,
      pooled: this.pool.length
    };
  }
}

// ===================== Pool Instances =====================

import type { PowerUp, PowerUpType, Bullet, Bomb, ProjectileType, Enemy, EnemyType, BonusLetter, BonusLetterType, Explosion, Particle } from "@/types/game";

// ID counter for entities that need unique IDs
let nextPowerUpId = 1;
let nextBulletId = 1;

// Extended types with required ID for pool tracking
type PooledPowerUp = PowerUp & { id: number };
type PooledBullet = Bullet & { id: number };

/**
 * Power-up pool
 * Max 50 power-ups active at once (generous limit)
 */
export const powerUpPool = new EntityPool<PooledPowerUp>(
  () => ({
    id: 0,
    x: 0,
    y: 0,
    width: 61,
    height: 61,
    type: "multiball" as PowerUpType,
    speed: 2,
    active: false,
    isMercyLife: false
  }),
  (p) => {
    p.active = false;
    p.isMercyLife = false;
    p.isDualChoice = false;
    p.pairedWithId = undefined;
  },
  20,
  50
);

/**
 * Bullet pool
 * Max 100 bullets for intense turret action
 */
export const bulletPool = new EntityPool<PooledBullet>(
  () => ({
    id: 0,
    x: 0,
    y: 0,
    width: 4,
    height: 12,
    speed: 7,
    isBounced: false,
    isSuper: false
  }),
  (b) => {
    b.isBounced = false;
    b.isSuper = false;
  },
  30,
  100
);

/**
 * Bomb pool for boss attacks
 * Max 60 bombs during intense boss fights
 */
export const bombPool = new EntityPool<Bomb>(
  () => ({
    id: 0,
    x: 0,
    y: 0,
    width: 12,
    height: 12,
    speed: 3,
    type: "bomb" as ProjectileType,
    isReflected: false,
    dx: undefined,
    dy: undefined,
    enemyId: undefined
  }),
  (b) => {
    b.isReflected = false;
    b.dx = undefined;
    b.dy = undefined;
    b.enemyId = undefined;
  },
  20,
  60
);

/**
 * Enemy pool
 * Max 40 enemies (plenty for normal gameplay)
 */
export const enemyPool = new EntityPool<Enemy>(
  () => ({
    id: 0,
    type: "cube" as EnemyType,
    x: 0,
    y: 0,
    width: 30,
    height: 30,
    rotation: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    speed: 1.5,
    dx: 0,
    dy: 1.5,
    hits: undefined,
    isAngry: false,
    isCrossBall: false,
    isLargeSphere: false,
    spawnTime: undefined
  }),
  (e) => {
    e.hits = undefined;
    e.isAngry = false;
    e.isCrossBall = false;
    e.isLargeSphere = false;
    e.spawnTime = undefined;
    e.buildTarget = undefined;
    e.buildProgress = 0;
    e.isBuilding = false;
  },
  15,
  40
);

/**
 * Bonus letter pool
 * Max 30 letters (QUMRAN has 6, so even 5x would be 30)
 */
export const bonusLetterPool = new EntityPool<BonusLetter>(
  () => ({
    x: 0,
    y: 0,
    originX: 0,
    spawnTime: 0,
    width: 50,
    height: 50,
    type: "Q" as BonusLetterType,
    speed: 1.5,
    active: false
  }),
  (l) => {
    l.active = false;
  },
  10,
  30
);

// ===================== Explosion Pool =====================

let nextExplosionId = 1;

type PooledExplosion = Explosion & { id: number };

/**
 * Explosion pool
 * Max 30 active explosions (generous -- typically < 10 concurrent)
 */
export const explosionPool = new EntityPool<PooledExplosion>(
  () => ({
    id: 0,
    x: 0,
    y: 0,
    frame: 0,
    maxFrames: 30,
    enemyType: undefined,
    particles: [] as Particle[],
  }),
  (e) => {
    e.frame = 0;
    e.maxFrames = 30;
    e.enemyType = undefined;
    // particles array is always [] (pool manages particles separately)
  },
  10,
  30
);

/**
 * Get next unique ID for explosions
 */
export function getNextExplosionId(): number {
  return nextExplosionId++;
}

/**
 * Reset all pools - call on game reset or level change
 */
export function resetAllPools(): void {
  powerUpPool.releaseAll();
  bulletPool.releaseAll();
  bombPool.releaseAll();
  enemyPool.releaseAll();
  bonusLetterPool.releaseAll();
  explosionPool.releaseAll();
}

/**
 * Get combined pool statistics
 */
export function getAllPoolStats(): Record<string, { active: number; pooled: number }> {
  return {
    powerUps: powerUpPool.getStats(),
    bullets: bulletPool.getStats(),
    bombs: bombPool.getStats(),
    enemies: enemyPool.getStats(),
    bonusLetters: bonusLetterPool.getStats(),
    explosions: explosionPool.getStats(),
  };
}

/**
 * Get next unique ID for power-ups
 */
export function getNextPowerUpId(): number {
  return nextPowerUpId++;
}

/**
 * Get next unique ID for bullets
 */
export function getNextBulletId(): number {
  return nextBulletId++;
}
