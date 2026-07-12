import { Pause, Volume2, VolumeX } from "lucide-react";
import { soundManager } from "@/utils/sounds";
import type { GameState } from "@/types/game";
import type { FixedStepGameLoop } from "@/utils/gameLoop";
import { ENABLE_DEBUG_FEATURES } from "@/constants/game";

interface MobileGameControlsProps {
  // Device info
  isMobileDevice: boolean;

  // Game state
  gameState: GameState;
  setGameState: (state: GameState) => void;
  gameLoopRef: React.RefObject<FixedStepGameLoop | null>;

  // Music control
  musicEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;
  onMusicToggled?: (enabled: boolean) => void;

  // Fullscreen
  showFullscreenPrompt: boolean;
  onFullscreenPromptClick: () => void;

  // Debug (optional)
  showDebugDashboard?: boolean;
  setShowDebugDashboard?: (show: boolean) => void;
}

/**
 * MobileGameControls - Fixed-position mobile UI elements
 * 
 * This component handles:
 * - Fullscreen prompt overlay
 * - Pause button (top-left)
 * - Music toggle button (top-right)
 * - Debug button (if debug features enabled)
 * 
 * Note: Power-up timers and bonus letter tutorial are NOT included here
 * because they need to be rendered at a specific position in the DOM tree
 * (outside the scaled container) for correct layout.
 */
export const MobileGameControls = ({
  isMobileDevice,
  gameState,
  setGameState,
  gameLoopRef,
  musicEnabled,
  setMusicEnabled,
  onMusicToggled,
  showFullscreenPrompt,
  onFullscreenPromptClick,
  showDebugDashboard,
  setShowDebugDashboard,
}: MobileGameControlsProps) => {
  if (!isMobileDevice) return null;

  return (
    <>
      {/* Fullscreen Prompt Overlay */}
      {showFullscreenPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={onFullscreenPromptClick}
        >
          <div className="text-center p-8 bg-background/90 rounded-lg border-2 border-primary">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Game Paused</h2>
            <p className="text-lg text-muted-foreground mb-2">Tap to enter fullscreen</p>
            <p className="text-sm text-muted-foreground">and resume playing</p>
          </div>
        </div>
      )}

      {/* Pause Button */}
      {gameState === "playing" && (
        <button
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setGameState("paused");
            if (gameLoopRef.current) {
              gameLoopRef.current.pause();
            }
          }}
          onClick={() => {
            setGameState("paused");
            if (gameLoopRef.current) {
              gameLoopRef.current.pause();
            }
          }}
          className="fixed left-4 top-[116px] z-[100] w-12 h-12 rounded-full bg-transparent border-2 border-white/30 flex items-center justify-center shadow-lg active:scale-95 transition-transform touch-manipulation"
          aria-label="Pause Game"
          style={{ touchAction: "manipulation" }}
        >
          <Pause className="w-6 h-6 text-white/70" />
        </button>
      )}

      {/* Music Toggle Button */}
      {gameState === "playing" && (
        <div className="fixed right-4 top-[116px] z-[100]">
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const newState = !musicEnabled;
              setMusicEnabled(newState);
              soundManager.setMusicEnabled(newState);
              if (newState) {
                soundManager.playBackgroundMusic();
              }
              onMusicToggled?.(newState);
            }}
            onClick={() => {
              const newState = !musicEnabled;
              setMusicEnabled(newState);
              soundManager.setMusicEnabled(newState);
              if (newState) {
                soundManager.playBackgroundMusic();
              }
              onMusicToggled?.(newState);
            }}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-transparent border-2 border-white/30 flex items-center justify-center shadow-lg active:scale-95 hover:border-white/50 transition-all touch-manipulation"
            aria-label="Toggle Music"
            style={{ touchAction: "manipulation" }}
          >
            {musicEnabled ? (
              <Volume2 className="w-5 h-5 md:w-6 md:h-6 text-white/70" />
            ) : (
              <VolumeX className="w-5 h-5 md:w-6 md:h-6 text-white/40" />
            )}
          </button>
        </div>
      )}

      {/* Mobile Debug Button */}
      {ENABLE_DEBUG_FEATURES && !showDebugDashboard && setShowDebugDashboard && (
        <button
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setShowDebugDashboard(true);
          }}
          onClick={() => setShowDebugDashboard(true)}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-[100] w-12 h-12 rounded-full bg-yellow-500/90 flex items-center justify-center text-2xl shadow-lg active:scale-95 transition-transform touch-manipulation"
          aria-label="Open Debug Dashboard"
          style={{ touchAction: "manipulation" }}
        >
          🐛
        </button>
      )}
    </>
  );
};
