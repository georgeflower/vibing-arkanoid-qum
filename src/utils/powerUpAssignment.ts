import type { PowerUpType, Brick, Difficulty } from "@/types/game";
import { 
  BRICK_POWER_UP_TYPES, 
  calculateCurrentWeights, 
  weightedRandomSelect 
} from "./powerUpWeights";

/** Chance that a power-up brick becomes a dual-choice brick */
const DUAL_CHOICE_CHANCE = 0.15;

/**
 * Pre-assigns power-up types to destructible bricks at level initialization.
 * Runtime drop chance is handled separately, but using per-brick assignments keeps
 * the existing weighted-selection and re-assignment architecture intact.
 */
export const assignPowerUpsToBricks = (
  bricks: Brick[],
  extraLifeUsedLevels: number[],
  currentLevel: number,
  difficulty: Difficulty,
  dropCounts: Partial<Record<PowerUpType, number>> = {},
  excludeLife: boolean = false,
): { assignments: Map<number, PowerUpType>; dualChoiceAssignments: Map<number, PowerUpType> } => {
  const assignments = new Map<number, PowerUpType>();
  const dualChoiceAssignments = new Map<number, PowerUpType>();

  // Get all destructible bricks (not metal, not indestructible)
  const destructibleBricks = bricks.filter(
    (brick) => brick.visible && !brick.isIndestructible && brick.type !== "metal"
  );

  if (destructibleBricks.length === 0) return { assignments, dualChoiceAssignments };

  // Calculate current weights based on drop history
  const currentWeights = calculateCurrentWeights(
    dropCounts,
    difficulty,
    currentLevel,
    extraLifeUsedLevels,
    false // Don't include boss-exclusive power-ups for brick assignments
  );

  // Track if extra life has been assigned this level (max 1)
  let extraLifeAssigned = false;
  
  // Create a mutable copy of weights to update during assignment
  const mutableWeights = { ...currentWeights };
  if (excludeLife && mutableWeights.life !== undefined) {
    delete mutableWeights.life;
  }

  // Assign weighted random power-up types to all destructible bricks.
  destructibleBricks.forEach((brick) => {
    // If extra life was just assigned, remove it from available weights
    if (extraLifeAssigned && mutableWeights.life !== undefined) {
      delete mutableWeights.life;
    }
    
    // Select using weighted random
    const selectedType = weightedRandomSelect(mutableWeights);
    assignments.set(brick.id, selectedType);
    
    // Mark extra life as assigned if selected
    if (selectedType === "life") {
      extraLifeAssigned = true;
    }

    // 25% chance this brick becomes a dual-choice brick
    if (Math.random() < DUAL_CHOICE_CHANCE) {
      // Pick a second type that's different from the first
      const weightsWithout = { ...mutableWeights };
      delete weightsWithout[selectedType as keyof typeof weightsWithout];
      if (Object.keys(weightsWithout).length > 0) {
        const secondType = weightedRandomSelect(weightsWithout);
        dualChoiceAssignments.set(brick.id, secondType);
      }
    }
  });

  return { assignments, dualChoiceAssignments };
};

/**
 * Re-assigns power-up types to remaining visible bricks after a power-up is collected.
 */
export const reassignPowerUpsToBricks = (
  currentAssignments: Map<number, PowerUpType>,
  bricks: Brick[],
  extraLifeUsedLevels: number[],
  currentLevel: number,
  difficulty: Difficulty,
  dropCounts: Partial<Record<PowerUpType, number>>,
  excludeLife: boolean = false,
): { assignments: Map<number, PowerUpType>; dualChoiceAssignments: Map<number, PowerUpType> } => {
  const dualChoiceAssignments = new Map<number, PowerUpType>();

  // Get remaining visible destructible bricks that still have assignments
  const remainingBricksWithPowerUps = bricks.filter(
    (brick) => 
      brick.visible && 
      !brick.isIndestructible && 
      brick.type !== "metal" &&
      currentAssignments.has(brick.id)
  );

  if (remainingBricksWithPowerUps.length === 0) {
    return { assignments: new Map(), dualChoiceAssignments };
  }

  // Calculate current weights based on updated drop history
  const currentWeights = calculateCurrentWeights(
    dropCounts,
    difficulty,
    currentLevel,
    extraLifeUsedLevels,
    false
  );

  const newAssignments = new Map<number, PowerUpType>();
  let extraLifeAssigned = false;
  const mutableWeights = { ...currentWeights };
  if (excludeLife && mutableWeights.life !== undefined) {
    delete mutableWeights.life;
  }

  // Re-assign power-ups to remaining bricks
  remainingBricksWithPowerUps.forEach((brick) => {
    if (extraLifeAssigned && mutableWeights.life !== undefined) {
      delete mutableWeights.life;
    }
    
    const selectedType = weightedRandomSelect(mutableWeights);
    newAssignments.set(brick.id, selectedType);
    
    if (selectedType === "life") {
      extraLifeAssigned = true;
    }

    // 25% chance for dual choice
    if (Math.random() < DUAL_CHOICE_CHANCE) {
      const weightsWithout = { ...mutableWeights };
      delete weightsWithout[selectedType as keyof typeof weightsWithout];
      if (Object.keys(weightsWithout).length > 0) {
        const secondType = weightedRandomSelect(weightsWithout);
        dualChoiceAssignments.set(brick.id, secondType);
      }
    }
  });

  return { assignments: newAssignments, dualChoiceAssignments };
};
