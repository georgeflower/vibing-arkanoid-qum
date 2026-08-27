// Level layouts - each layout is a 2D array where:
// false = no brick, true = normal brick, 2 = indestructible brick (from level 10+)
// Returns the number of hits required for a brick at this position and level
export const getBrickHits = (level: number, row: number): number => {
  if (level < 3) return 1;
  if (level < 5) return row < 2 ? 2 : 1;
  if (level < 8) return row < 3 ? 2 : 1;
  if (level < 12) return row < 2 ? 3 : row < 4 ? 2 : 1;
  if (level < 18) return row < 3 ? 3 : row < 5 ? 2 : 1;
  if (level < 25) return row < 2 ? 4 : row < 4 ? 3 : row < 6 ? 2 : 1;
  if (level < 35) return row < 3 ? 4 : row < 5 ? 3 : row < 7 ? 2 : 1;
  if (level < 45) return row < 2 ? 5 : row < 4 ? 4 : row < 6 ? 3 : row < 8 ? 2 : 1;
  return row < 3 ? 6 : row < 5 ? 5 : row < 7 ? 4 : row < 9 ? 3 : row < 11 ? 2 : 1;
};

// Visible brick counts after pacing rebalance:
// L1 26, L2 55, L3 56, L4 58, L5 82 (boss unchanged),
// L6 85, L7 86, L8 89, L9 87, L10 143 (boss unchanged),
// L11 76, L12 67, L13 86, L14 86, L15 92 (boss unchanged),
// L16 85, L17 75, L18 78, L19 88, L20 169 (boss unchanged).
export const levelLayouts: (boolean | number)[][][] = [
  // Level 1
  [
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, true, true, true, true, true, false, false, false, false],
    [false, false, false, true, true, false, true, false, true, true, false, false, false],
    [false, false, false, true, false, false, true, false, false, true, false, false, false],
    [false, false, false, false, true, true, true, true, true, false, false, false, false],
    [false, false, false, true, false, true, true, true, false, true, false, false, false],
    [false, false, false, true, false, false, true, false, false, true, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 2
  [
    [false, false, false, true, true, true, false, true, true, true, false, false, false],
    [false, true, false, false, true, false, false, false, true, false, false, true, false],
    [false, true, true, false, false, false, true, false, false, false, true, true, false],
    [false, false, true, true, false, true, false, true, false, true, true, false, false],
    [false, false, false, false, true, false, true, false, true, false, false, false, false],
    [false, false, false, true, false, true, true, true, false, true, false, false, false],
    [false, false, true, false, true, false, true, false, true, false, true, false, false],
    [false, true, true, false, true, true, true, true, true, false, true, true, false],
    [false, 4, false, false, false, true, false, true, false, false, false, 4, false],
    [false, true, false, false, true, false, false, false, true, false, false, true, false],
    [false, false, true, true, false, false, false, false, false, true, true, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 3
  [
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, true, true, true, false, false, false, true, true, true, false, false],
    [false, true, false, false, false, true, false, true, false, false, false, true, false],
    [true, false, true, 4, true, false, 3, false, true, 4, true, false, true],
    [4, false, true, true, true, true, false, true, true, true, true, false, 4],
    [false, 4, false, true, 3, true, true, true, 3, true, false, 4, false],
    [false, false, true, false, 4, true, true, true, 4, false, true, false, false],
    [false, false, false, true, false, true, true, true, false, true, false, false, false],
    [false, false, false, false, true, false, true, false, true, false, false, false, false],
    [false, false, false, false, false, true, false, true, false, false, false, false, false],
    [false, false, false, false, false, false, true, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 4
  [
    [false, false, false, false, 2, 2, 2, 2, 2, false, false, false, false],
    [false, false, false, false, 2, 3, true, 3, 2, false, false, false, false],
    [false, false, true, false, 2, false, false, false, 2, false, true, false, false],
    [false, 4, 4, true, false, false, false, false, false, true, 4, 4, false],
    [false, false, true, true, true, false, false, false, true, true, true, false, false],
    [false, true, true, false, true, true, false, true, true, false, true, true, false],
    [true, false, false, true, false, false, true, false, false, true, false, false, true],
    [false, true, true, false, true, true, false, true, true, false, true, true, false],
    [false, false, true, true, true, false, false, false, true, true, true, false, false],
    [false, false, false, true, false, false, 3, false, false, true, false, false, false],
    [false, false, true, false, false, false, false, false, false, false, true, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 5
  [
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, true, false, false, true, false, false, true, false, false, false],
    [3, false, true, true, false, true, true, true, false, true, true, false, 3],
    [false, false, true, true, false, true, true, true, false, true, true, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, true, true, true, true, true, 3, true, true, true, true, true, false],
    [true, false, true, true, false, false, false, false, false, true, true, false, true],
    [true, true, true, true, true, true, true, true, true, true, true, true, true],
    [true, false, true, false, false, false, true, false, false, false, true, false, true],
    [true, true, false, false, 2, false, true, false, 2, false, false, true, true],
    [false, true, false, false, 2, false, 2, false, 2, false, false, true, true],
    [false, true, true, true, true, true, true, true, true, true, true, true, false],
    [false, false, true, false, false, false, false, false, false, false, true, false, false],
    [false, false, false, true, false, false, false, false, false, true, false, false, false],
  ],

  // Level 6
  [
    [true, false, true, false, true, false, false, false, true, false, true, false, true],
    [false, true, false, true, false, true, false, true, false, true, false, true, false],
    [true, false, 4, false, true, false, false, false, true, false, 4, false, true],
    [false, 4, 3, 4, false, true, false, true, false, 4, 3, 4, false],
    [true, false, 4, false, true, false, false, false, true, false, 4, false, true],
    [false, true, false, true, false, true, false, true, false, true, false, true, false],
    [true, false, true, false, true, false, false, false, true, false, true, false, true],
    [false, true, false, true, false, true, false, false, false, true, false, false, false],
    [true, false, true, 2, true, false, false, false, true, false, true, 2, true],
    [false, false, 4, 3, 4, false, false, false, false, false, false, true, false],
    [true, 2, true, 4, true, 2, false, false, true, 2, true, false, true],
    [false, true, false, true, false, true, false, false, false, true, false, true, false],
    [true, false, true, false, true, false, false, false, true, false, true, false, true],
    [false, true, false, true, false, false, false, false, false, true, false, true, false],
  ],

  // Level 7
  [
    [true, true, 4, false, false, false, false, false, false, false, 4, true, true],
    [true, true, true, 4, false, false, false, false, false, 4, true, true, true],
    [4, true, true, true, 4, false, false, false, 4, true, true, true, 4],
    [false, 4, true, true, true, 4, false, 4, true, true, true, 4, false],
    [false, false, 4, true, true, true, false, true, true, true, 4, false, false],
    [false, false, false, 4, true, true, false, true, true, 4, false, false, false],
    [false, false, false, false, 4, true, false, true, 4, false, false, false, false],
    [false, false, false, false, 2, 2, false, 2, 2, false, false, false, false],
    [false, false, false, false, false, true, false, true, false, false, false, false, false],
    [false, false, false, false, true, true, false, true, true, false, false, false, false],
    [false, false, false, true, true, true, false, true, true, true, false, false, false],
    [false, false, true, true, true, false, false, false, true, true, true, false, false],
    [false, true, true, true, false, false, false, false, false, true, true, true, false],
    [true, true, true, false, false, false, false, false, false, false, true, true, true],
  ],

  // Level 8
  [
    [false, true, true, true, false, false, true, false, false, true, true, true, false],
    [true, false, false, false, true, false, false, false, true, false, false, false, true],
    [true, false, true, true, false, false, 3, false, false, true, true, false, true],
    [true, false, true, true, 3, false, true, false, 3, true, true, false, true],
    [true, false, false, true, 2, false, false, false, 2, true, false, false, true],
    [2, false, false, true, 2, false, true, false, 2, true, false, false, 2],
    [false, 2, false, true, 2, false, true, false, 2, false, true, 2, false],
    [2, true, false, false, 2, 2, false, 2, 2, false, false, true, 2],
    [true, false, true, true, 2, false, false, false, 2, true, true, false, true],
    [true, false, false, false, 4, false, false, false, 4, false, false, false, true],
    [true, false, false, false, 4, true, true, true, 4, false, false, false, true],
    [true, false, false, false, 4, false, false, false, 4, false, false, false, true],
    [false, true, true, true, false, false, true, false, false, true, true, true, false],
    [false, false, false, true, false, true, false, true, false, true, false, false, false],
  ],

  // Level 9
  [
    [4, false, false, false, 4, false, 2, false, 4, false, false, false, 4],
    [true, false, true, false, false, false, false, false, true, false, true, false, true],
    [false, true, false, true, false, false, 2, false, false, true, false, true, false],
    [4, false, false, true, 4, false, 2, false, 4, true, false, false, 4],
    [false, true, true, false, false, 3, 3, 3, false, false, true, true, false],
    [4, true, 3, false, 4, false, false, false, 4, false, 3, true, 4],
    [false, true, false, true, false, false, 2, false, false, true, false, true, false],
    [4, true, true, false, false, false, false, false, false, false, true, true, 4],
    [false, true, true, 3, 3, false, false, false, 3, 3, true, true, false],
    [4, true, 3, false, false, false, false, false, false, 3, false, true, 4],
    [false, true, true, false, true, false, 2, false, true, false, true, true, false],
    [false, 4, true, false, false, false, false, false, false, false, false, true, 4],
    [false, true, true, false, false, true, 2, true, false, false, true, true, false],
    [4, false, false, true, true, false, 2, false, true, true, false, false, 4],
  ],

  // Level 10
  [
    [false, 2, 2, 2, 2, false, false, false, 2, 2, 2, 2, false],
    [true, true, true, true, true, true, true, true, true, true, true, true, true],
    [true, true, true, true, true, true, true, true, true, true, true, true, true],
    [true, true, true, true, true, true, true, true, true, true, true, true, true],
    [2, 2, 2, true, true, true, true, true, true, true, 2, 2, 2],
    [false, false, false, true, true, true, true, true, true, true, false, false, false],
    [false, false, false, true, true, true, true, true, true, true, false, false, false],
    [false, false, false, true, true, true, 2, true, true, true, false, false, false],
    [false, false, false, true, true, true, true, true, true, true, false, false, false],
    [false, false, false, true, true, true, true, true, true, true, false, false, false],
    [false, 2, 2, true, true, true, true, true, true, true, 2, 2, false],
    [false, true, true, true, true, true, true, true, true, true, true, true, false],
    [true, true, true, true, true, true, true, true, true, true, true, true, true],
    [2, 2, 2, true, true, true, true, true, true, true, 2, 2, 2],
  ],

  // Level 11
  [
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, 2, 2, 2, 2, true, false, true, 2, 2, 2, 2, false],
    [false, 4, false, false, 2, true, false, true, 2, false, false, 4, false],
    [false, 4, false, false, 3, true, false, true, 3, false, false, 4, false],
    [false, 2, true, true, true, false, false, false, true, true, true, 2, false],
    [false, 2, true, true, true, false, 3, false, true, true, true, 2, false],
    [false, 3, true, true, false, false, 2, false, false, true, true, 3, false],
    [false, true, true, true, true, false, true, false, true, true, true, true, false],
    [false, 2, true, true, false, false, false, false, false, true, true, 2, false],
    [false, 2, true, true, true, false, false, false, true, true, true, 2, false],
    [false, 2, 4, false, false, 2, 4, 4, 2, false, false, 2, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 12
  [
    [false, false, false, false, false, false, 3, false, false, false, false, false, false],
    [false, false, false, false, false, 2, true, 2, false, false, false, false, false],
    [false, false, false, false, 2, true, false, true, 2, false, false, false, false],
    [false, false, false, 4, true, false, false, false, true, 4, false, false, false],
    [false, false, 2, true, false, false, true, false, false, true, 2, false, false],
    [false, 4, true, false, false, true, 4, true, false, false, true, 4, false],
    [2, true, false, false, true, 4, 3, 4, true, false, false, true, 2],
    [false, 4, false, true, true, true, 4, true, true, true, false, 4, false],
    [false, false, 2, true, true, true, true, true, true, true, 2, false, false],
    [false, false, false, 2, true, true, true, true, true, 2, false, false, false],
    [false, false, false, false, 2, true, 3, true, 2, false, false, false, false],
    [false, false, false, false, false, 2, 3, 2, false, false, false, false, false],
    [false, false, false, false, false, false, 2, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 13
  [
    [2, 2, 2, 2, 2, false, false, false, 2, 2, 2, 2, 2],
    [false, false, false, true, true, true, false, true, false, true, true, true, false],
    [false, false, 2, 2, false, true, 3, true, false, 2, 2, false, false],
    [2, false, false, 3, 4, true, false, true, 4, 3, false, false, 2],
    [2, false, false, 3, 2, true, true, true, 2, 3, false, false, 2],
    [2, false, true, false, 2, false, true, false, 2, false, true, false, 2],
    [2, false, true, false, false, false, 2, false, false, false, true, false, 2],
    [false, false, true, false, true, 3, false, 3, true, false, true, false, false],
    [2, 4, false, 2, false, true, 3, true, false, 2, false, 4, 2],
    [4, false, 4, false, 3, 3, 3, 3, 3, 3, false, 4, false],
    [2, 2, false, 4, 2, false, 4, false, 2, 4, false, 2, 2],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 14
  [
    [true, true, true, true, true, false, true, false, true, true, true, true, true],
    [true, 4, false, false, false, false, false, false, false, false, false, 4, true],
    [true, false, false, true, false, false, false, false, false, true, false, false, true],
    [true, 4, false, true, false, 4, 4, 4, false, true, false, 4, true],
    [true, false, false, true, false, true, false, true, false, true, false, false, true],
    [true, 4, false, false, false, 4, false, 4, false, false, false, 4, true],
    [true, false, false, true, false, 4, false, 3, false, true, false, false, true],
    [true, 4, false, false, false, 4, false, 4, false, false, false, 4, true],
    [true, false, false, true, false, true, false, true, false, true, false, false, true],
    [true, 4, false, true, false, 4, 4, 4, false, true, false, 4, true],
    [true, false, false, true, false, false, false, false, false, true, false, false, true],
    [true, 4, false, false, false, false, false, false, false, false, false, 4, true],
    [true, true, true, true, true, false, true, false, true, true, true, true, true],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 15: Stripes
  [
    [true, false, true, false, true, false, true, false, true, false, true, false, true],
    [true, false, true, false, true, false, true, false, true, false, true, false, true],
    [true, false, true, false, true, false, true, false, true, false, true, false, true],
    [false, true, false, true, false, true, false, true, false, true, false, true, false],
    [false, true, false, true, false, true, false, true, false, true, false, true, false],
    [false, true, false, true, false, true, false, true, false, true, false, true, false],
    [true, false, true, false, true, false, true, false, true, false, true, false, true],
    [true, false, true, false, true, false, true, false, true, false, true, false, true],
    [true, false, true, false, true, false, true, false, true, false, true, false, true],
    [false, true, false, true, false, true, false, true, false, true, false, true, false],
    [false, true, false, true, false, true, false, true, false, true, false, true, false],
    [false, true, false, true, false, true, false, true, false, true, false, true, false],
    [true, false, true, false, true, false, true, false, true, false, true, false, true],
    [true, false, true, false, true, false, true, false, true, false, true, false, true],
  ],

  // Level 16
  [
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, 4, 4, 4, false, false, false, false, false],
    [false, false, false, 2, 4, true, false, true, 4, 2, false, false, false],
    [false, false, 2, 2, true, true, false, true, true, 2, 2, false, false],
    [false, 2, 2, true, true, true, false, false, false, true, true, true, false],
    [2, 2, 2, 2, 2, false, 3, false, 2, 2, 2, 2, 2],
    [2, true, true, true, false, false, false, false, false, true, true, true, 2],
    [2, false, false, false, false, false, false, false, false, false, false, false, 2],
    [2, true, true, true, false, false, false, false, false, true, true, true, 2],
    [2, 2, true, true, false, false, true, false, false, true, true, 2, 2],
    [false, 2, 2, true, true, true, false, false, false, 2, 2, false, false],
    [false, false, 2, 2, true, true, false, true, true, 2, 2, false, false],
    [false, false, false, 2, 2, 4, 4, 4, 2, 2, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 17
  [
    [false, false, false, false, false, false, true, false, false, false, false, false, false],
    [false, false, false, false, false, true, true, true, false, false, false, false, false],
    [false, false, false, false, true, true, true, true, true, false, false, false, false],
    [false, false, 3, true, true, true, true, true, true, true, 3, false, false],
    [false, false, false, false, false, true, true, true, false, false, false, false, false],
    [false, 2, 2, 2, 2, true, true, true, 2, 2, 2, 2, false],
    [4, true, true, false, false, true, true, true, false, false, true, true, 4],
    [false, 4, true, true, false, true, true, true, false, true, true, 4, false],
    [false, false, 4, true, true, true, true, true, true, true, 4, false, false],
    [false, false, false, 4, true, true, true, true, true, 4, false, false, false],
    [false, false, false, false, 4, true, true, true, 4, false, false, false, false],
    [false, false, false, false, false, 4, true, 4, false, false, false, false, false],
    [false, false, false, false, false, false, 4, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 18
  [
    [2, 2, 2, true, true, false, false, false, true, true, 2, 2, 2],
    [2, true, false, 3, true, false, false, false, true, 3, false, true, 2],
    [2, true, 2, 2, 2, false, false, false, 2, 2, 2, true, 2],
    [false, true, true, true, true, false, false, false, true, true, true, true, false],
    [false, false, true, true, true, false, false, false, true, true, true, false, false],
    [false, false, false, 2, 2, false, 4, false, 2, 2, false, false, false],
    [false, false, false, 2, true, true, false, true, true, 2, false, false, false],
    [false, false, false, 2, true, false, false, false, true, 2, false, false, false],
    [false, false, false, 2, true, false, 3, false, true, 2, false, false, false],
    [false, false, false, 2, true, false, false, false, true, 2, false, false, false],
    [false, false, false, 2, true, true, false, true, true, 2, false, false, false],
    [false, false, false, 2, 2, 2, false, false, false, 2, 2, 2, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 19
  [
    [false, false, false, true, true, true, false, true, true, true, false, false, false],
    [false, false, true, true, true, false, false, false, true, true, true, false, false],
    [false, true, true, false, false, false, false, false, false, false, true, true, false],
    [true, true, false, 4, 4, false, false, false, 4, 4, false, true, true],
    [true, false, false, 4, true, true, false, true, true, 4, false, false, true],
    [true, false, false, 4, true, 2, 3, false, true, 4, false, false, true],
    [true, false, false, 4, true, 2, false, 2, true, 4, false, false, true],
    [true, false, false, 4, true, 2, 2, false, true, 4, false, false, true],
    [true, false, false, 4, true, true, false, true, true, 4, false, false, true],
    [true, true, false, 4, 4, false, false, false, 4, 4, false, true, true],
    [false, true, true, false, false, false, false, false, false, false, true, true, false],
    [false, false, true, true, true, false, false, false, true, true, true, false, false],
    [false, false, false, true, true, true, false, true, true, true, false, false, false],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],

  // Level 20
  [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [4, true, true, true, true, true, 2, true, true, true, true, true, 4],
    [4, true, 2, 2, 2, true, 2, true, 2, 2, 2, true, 4],
    [2, true, 2, 3, 2, true, 2, true, 2, 3, 2, true, 2],
    [2, true, 2, true, 2, true, true, true, 2, true, 2, true, 2],
    [2, true, 2, true, 2, 2, true, 2, 2, true, 2, true, 2],
    [2, true, true, true, true, true, 3, true, true, true, true, true, 2],
    [2, true, 2, true, 2, 2, true, 2, 2, true, 2, true, 2],
    [2, true, 2, true, 2, true, true, true, 2, true, 2, true, 2],
    [2, true, 2, 3, 2, true, 2, true, 2, 3, 2, true, 2],
    [2, true, 2, 2, 2, true, 2, true, 2, 2, 2, true, 2],
    [2, true, true, true, true, 4, 2, 4, true, true, true, true, 2],
    [2, 2, 2, 4, 2, 4, 2, 4, 2, 4, 2, 2, 2],
    [false, false, false, false, false, false, false, false, false, false, false, false, false],
  ],
];
