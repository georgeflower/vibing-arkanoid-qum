import { useState, useEffect } from "react";
import { Game } from "@/components/Game";
import { MainMenu } from "@/components/MainMenu";
import AssetPreloader from "@/components/AssetPreloader";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";
import type { GameSettings } from "@/types/game";

const Index = () => {
  const [phase, setPhase] = useState<"menu" | "preloading" | "game">("menu");
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [isStartingGame, setIsStartingGame] = useState(false);

  // Check for SW updates on main menu or when starting a new game
  useServiceWorkerUpdate({
    isMainMenu: phase === "menu",
    isStartingGame,
    shouldApplyUpdate: phase === "menu",
  });

  // Reset isStartingGame flag after it's been processed
  useEffect(() => {
    if (isStartingGame) {
      setIsStartingGame(false);
    }
  }, [isStartingGame]);

  const handleStartGame = (settings: GameSettings) => {
    setIsStartingGame(true);
    setGameSettings(settings);
    setPhase("preloading");
  };

  const handlePreloadComplete = () => {
    setPhase("game");
  };

  const handleReturnToMenu = () => {
    setPhase("menu");
    setGameSettings(null);
  };

  if (phase === "menu") {
    return <MainMenu onStartGame={handleStartGame} />;
  }

  if (phase === "preloading" && gameSettings) {
    return <AssetPreloader onComplete={handlePreloadComplete} />;
  }

  if (phase === "game" && gameSettings) {
    return <Game settings={gameSettings} onReturnToMenu={handleReturnToMenu} />;
  }

  return <MainMenu onStartGame={handleStartGame} />;
};

export default Index;
