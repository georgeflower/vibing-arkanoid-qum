import { useState, useEffect } from "react";
import { Game } from "@/components/Game";
import { MainMenu } from "@/components/MainMenu";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";
import AssetLoadingOverlay from "@/components/AssetLoadingOverlay";
import type { GameSettings } from "@/types/game";

const Index = () => {
  const [phase, setPhase] = useState<"menu" | "game">("menu");
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [isStartingGame, setIsStartingGame] = useState(false);

  useServiceWorkerUpdate({
    isMainMenu: phase === "menu",
    isStartingGame,
    shouldApplyUpdate: phase === "menu",
  });

  useEffect(() => {
    if (isStartingGame) {
      setIsStartingGame(false);
    }
  }, [isStartingGame]);

  const handleStartGame = (settings: GameSettings) => {
    setIsStartingGame(true);
    setGameSettings(settings);
    setPhase("game");
  };

  const handleReturnToMenu = () => {
    setPhase("menu");
    setGameSettings(null);
  };

  return (
    <>
      {phase === "game" && gameSettings ? (
        <Game settings={gameSettings} onReturnToMenu={handleReturnToMenu} />
      ) : (
        <MainMenu onStartGame={handleStartGame} />
      )}
      <AssetLoadingOverlay />
    </>
  );
};

export default Index;
