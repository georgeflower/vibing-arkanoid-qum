import { useState } from "react";
import { Game } from "@/components/Game";
import { MainMenu } from "@/components/MainMenu";
import AssetLoadingOverlay from "@/components/AssetLoadingOverlay";
import type { GameSettings } from "@/types/game";

const Index = () => {
  const [phase, setPhase] = useState<"menu" | "game">("menu");
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);

  const handleStartGame = (settings: GameSettings) => {
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
