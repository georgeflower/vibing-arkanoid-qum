import { useState, useEffect } from "react";
import { useHighScores } from "@/hooks/useHighScores";

export const TopScoresDisplay = () => {
  const { fetchTopScores } = useHighScores();
  const [topScores, setTopScores] = useState<{
    daily: { name: string; score: number } | null;
    weekly: { name: string; score: number } | null;
    allTime: { name: string; score: number } | null;
  }>({ daily: null, weekly: null, allTime: null });
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [animationPhase, setAnimationPhase] = useState<"showing" | "transitioning">("showing");
  const [flickerOpacity, setFlickerOpacity] = useState(1);

  useEffect(() => {
    const loadTopScores = async () => {
      const scores = await fetchTopScores();
      setTopScores(scores);
    };
    loadTopScores();
  }, [fetchTopScores]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    const runCycle = () => {
      // Phase 1: Show for 5 seconds
      setAnimationPhase("showing");
      
      timeout = setTimeout(() => {
        // Phase 2: Start transition (scroll out + scroll in = 6 seconds total)
        setNextIndex((currentIndex + 1) % 3);
        setAnimationPhase("transitioning");
        
        timeout = setTimeout(() => {
          // Complete transition, update current index
          setCurrentIndex((prev) => (prev + 1) % 3);
          runCycle();
        }, 6000); // Total transition time (3s out + 3s in)
      }, 5000); // showing duration
    };
    
    runCycle();
    
    return () => clearTimeout(timeout);
  }, [currentIndex]);

  // LED flicker effect
  useEffect(() => {
    const flickerInterval = setInterval(() => {
      // Random subtle opacity variation between 0.92 and 1.0
      const newOpacity = 0.92 + Math.random() * 0.08;
      setFlickerOpacity(newOpacity);
    }, 100 + Math.random() * 150); // Random interval between 100-250ms
    
    return () => clearInterval(flickerInterval);
  }, []);

  const formatScore = (score: number | undefined) => {
    if (!score) return "---";
    return score.toString().padStart(6, "0");
  };

  const getDisplayText = (index: number) => {
    const labels = ["TODAY", "WEEKLY", "ALL-TIME"];
    const scores = [topScores.daily, topScores.weekly, topScores.allTime];
    const current = scores[index];
    const label = labels[index];
    
    if (!current) return `${label}: ---`;
    return `${label}: ${current.name} ${formatScore(current.score)}`;
  };

  const textStyle = {
    fontFamily: "'Press Start 2P', monospace",
    color: "#ff9500",
    textShadow: "0 0 10px rgba(255, 149, 0, 0.6), 0 0 20px rgba(255, 149, 0, 0.3)",
    opacity: flickerOpacity,
  };

  return (
    <div className="retro-border bg-black/90 backdrop-blur-sm rounded-lg p-3 w-full overflow-hidden">
      <div className="relative h-8 flex items-center justify-center">
        {/* Current text - scrolls out to the left */}
        <div
          key={`current-${currentIndex}-${animationPhase}`}
          className="absolute text-xs md:text-sm tracking-wider whitespace-nowrap"
          style={{
            ...textStyle,
            animation: animationPhase === "transitioning" 
              ? "scrollOutLeft 3s ease-in-out forwards" 
              : "none",
          }}
        >
          {getDisplayText(currentIndex)}
        </div>
        
        {/* Next text - scrolls in from the right after 3s (when scroll-out completes) */}
        {animationPhase === "transitioning" && (
          <div
            key={`next-${nextIndex}`}
            className="absolute text-xs md:text-sm tracking-wider whitespace-nowrap"
            style={{
              ...textStyle,
              animation: "scrollInRight 3s 1s ease-in-out forwards",
              transform: "translateX(200%)",
            }}
          >
            {getDisplayText(nextIndex)}
          </div>
        )}
      </div>
    </div>
  );
};
