import type { Boss } from "@/types/game";

interface GameUIProps {
  score: number;
  lives: number;
  level: number;
  timer: number;
  speed: number;
  bossHitCooldown?: number;
  boss?: Boss | null;
}

export const GameUI = ({ score, lives, level, timer, speed, bossHitCooldown = 0, boss = null }: GameUIProps) => {
  return (
    <div className="flex flex-row gap-4 flex-wrap justify-center">
      {/* Score */}
      <div className="amiga-box px-4 py-3 min-w-[140px]">
        <div className="text-[10px] retro-pixel-text mb-2 text-center" style={{ color: 'hsl(0, 0%, 60%)' }}>
          SCORE
        </div>
        <div className="text-xl retro-pixel-text text-center" style={{ color: 'hsl(0, 0%, 85%)' }}>
          {score.toString().padStart(6, "0")}
        </div>
      </div>

      {/* Level */}
      <div className="amiga-box px-4 py-3 min-w-[140px]">
        <div className="text-[10px] retro-pixel-text mb-2 text-center" style={{ color: 'hsl(30, 75%, 55%)' }}>
          LEVEL
        </div>
        <div className="text-xl retro-pixel-text text-center" style={{ color: 'hsl(0, 0%, 85%)' }}>
          {level.toString().padStart(2, "0")}
        </div>
      </div>

      {/* Lives */}
      <div className="amiga-box px-4 py-3 min-w-[140px]">
        <div className="text-[10px] retro-pixel-text mb-2 text-center" style={{ color: 'hsl(0, 70%, 55%)' }}>
          LIVES
        </div>
        <div className="text-xl retro-pixel-text text-center" style={{ color: 'hsl(0, 0%, 85%)' }}>
          {lives}
        </div>
      </div>

      {/* Timer */}
      <div className="amiga-box px-4 py-3 min-w-[140px]">
        <div className="text-[10px] retro-pixel-text mb-2 text-center" style={{ color: 'hsl(210, 60%, 55%)' }}>
          TIMER
        </div>
        <div className="text-xl retro-pixel-text text-center" style={{ color: 'hsl(0, 0%, 85%)' }}>
          {timer}s
        </div>
      </div>

      {/* Speed */}
      <div className="amiga-box px-4 py-3 min-w-[140px]">
        <div className="text-[10px] retro-pixel-text mb-2 text-center" style={{ color: 'hsl(120, 50%, 50%)' }}>
          SPEED
        </div>
        <div className="text-xl retro-pixel-text text-center" style={{ color: 'hsl(0, 0%, 85%)' }}>
          {Math.round(speed * 100)}%
        </div>
      </div>

      {/* Boss Cooldown - Only show when boss is active and cooldown > 0 */}
      {boss && bossHitCooldown > 0 && (
        <div className="amiga-box px-4 py-3 min-w-[140px]">
          <div className="text-[10px] retro-pixel-text mb-2 text-center" style={{ color: 'hsl(0, 80%, 60%)' }}>
            BOSS CD
          </div>
          <div className="text-xl retro-pixel-text text-center animate-pulse" style={{ color: 'hsl(0, 80%, 65%)' }}>
            {(bossHitCooldown / 1000).toFixed(1)}s
          </div>
        </div>
      )}
    </div>
  );
};
