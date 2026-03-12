/**
 * Particle Limits - Phase 4 of Performance Optimization System
 * 
 * Controls particle counts based on quality settings to maintain performance
 */

import type { QualityLevel } from '@/hooks/useAdaptiveQuality';

export interface ParticleLimits {
  maxTotal: number;
  maxPerExplosion: number;
  maxPerHighScore: number;
  maxPerGameOver: number;
}

export const PARTICLE_LIMITS: Record<QualityLevel, ParticleLimits> = {
  potato: {
    maxTotal: 30,
    maxPerExplosion: 5,
    maxPerHighScore: 15,
    maxPerGameOver: 20,
  },
  low: {
    maxTotal: 30,
    maxPerExplosion: 5,
    maxPerHighScore: 15,
    maxPerGameOver: 20,
  },
  medium: {
    maxTotal: 80,
    maxPerExplosion: 10,
    maxPerHighScore: 30,
    maxPerGameOver: 50,
  },
  high: {
    maxTotal: 200,
    maxPerExplosion: 15,
    maxPerHighScore: 60,
    maxPerGameOver: 100,
  },
};

/**
 * Get particle limits for the current quality level
 */
export function getParticleLimits(quality: QualityLevel): ParticleLimits {
  return PARTICLE_LIMITS[quality];
}

/**
 * Check if we should create a new particle given current count and limits
 */
export function shouldCreateParticle(
  currentCount: number,
  quality: QualityLevel,
  particleType: 'explosion' | 'highScore' | 'gameOver' | 'general' = 'general'
): boolean {
  const limits = getParticleLimits(quality);
  
  // Check total limit first
  if (currentCount >= limits.maxTotal) {
    return false;
  }

  // Check specific limit based on type (if needed for batch creation)
  // This is more for batch creation scenarios
  return true;
}

/**
 * Calculate how many particles to create for an effect
 */
export function calculateParticleCount(
  requestedCount: number,
  currentCount: number,
  quality: QualityLevel,
  particleType: 'explosion' | 'highScore' | 'gameOver'
): number {
  const limits = getParticleLimits(quality);
  
  // Get the specific limit for this type
  let specificLimit: number;
  switch (particleType) {
    case 'explosion':
      specificLimit = limits.maxPerExplosion;
      break;
    case 'highScore':
      specificLimit = limits.maxPerHighScore;
      break;
    case 'gameOver':
      specificLimit = limits.maxPerGameOver;
      break;
  }

  // Use the minimum of:
  // 1. Requested count
  // 2. Specific limit for this effect type
  // 3. Remaining budget based on total limit
  const remainingBudget = Math.max(0, limits.maxTotal - currentCount);
  
  return Math.min(requestedCount, specificLimit, remainingBudget);
}
