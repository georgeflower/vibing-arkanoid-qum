import { Settings } from "lucide-react";
import type { QualityLevel } from "@/hooks/useAdaptiveQuality";

interface QualityIndicatorProps {
  quality: QualityLevel;
  autoAdjustEnabled: boolean;
  fps?: number;
}

const DISPLAY_NAMES: Record<QualityLevel, string> = {
  potato: "Kartoffel",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const QualityIndicator = ({ quality, autoAdjustEnabled, fps }: QualityIndicatorProps) => {
  const getQualityColor = (level: QualityLevel) => {
    switch (level) {
      case 'high':
        return 'hsl(120, 60%, 50%)';
      case 'medium':
        return 'hsl(50, 90%, 55%)';
      case 'low':
        return 'hsl(0, 70%, 55%)';
      case 'potato':
        return 'hsl(30, 50%, 40%)';
    }
  };

  const getFpsColor = (fpsValue: number) => {
    if (fpsValue >= 55) return 'hsl(120, 60%, 50%)';
    if (fpsValue >= 50) return 'hsl(50, 90%, 55%)';
    return 'hsl(0, 70%, 55%)';
  };

  return (
    <div className="fixed top-4 right-4 z-40 pointer-events-none select-none">
      <div className="flex flex-col gap-1 bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/20">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">Quality:</span>
            <span 
              className="text-xs font-bold uppercase font-mono"
              style={{ color: getQualityColor(quality) }}
            >
              {DISPLAY_NAMES[quality]}
            </span>
            {autoAdjustEnabled && (
              <span className="text-[10px] text-muted-foreground/70 font-mono ml-1">
                (AUTO)
              </span>
            )}
          </div>
        </div>
        {fps !== undefined && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted-foreground">FPS:</span>
            <span 
              className="font-bold"
              style={{ color: getFpsColor(fps) }}
            >
              {Math.round(fps)}
            </span>
          </div>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground/50 mt-1 text-center font-mono">
        Press Q to cycle • Shift+Q toggle auto
      </div>
    </div>
  );
};
