import { useState } from "react";
import { Game } from "@/components/Game";
import { MainMenu } from "@/components/MainMenu";
import AssetLoadingOverlay from "@/components/AssetLoadingOverlay";
import type { GameSettings, Difficulty, GameMode } from "@/types/game";

const Index = () => {
  const [phase, setPhase] = useState<"menu" | "game">("menu");
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);

  // Lifted menu state — persists across game returns
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [gameMode, setGameMode] = useState<GameMode>("normal");
  const [startingLevel, setStartingLevel] = useState(1);
  const [hasStartedOnce, setHasStartedOnce] = useState(false);

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
        <MainMenu
          onStartGame={handleStartGame}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          gameMode={gameMode}
          setGameMode={setGameMode}
          startingLevel={startingLevel}
          setStartingLevel={setStartingLevel}
          hasStartedOnce={hasStartedOnce}
          setHasStartedOnce={setHasStartedOnce}
        />
      )}
      <AssetLoadingOverlay />
    </>
  );
};

export default Index;
