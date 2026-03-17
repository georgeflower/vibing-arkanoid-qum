import { useState, useEffect } from "react";
import { useAssetPreloader } from "@/hooks/useAssetPreloader";

const AssetLoadingOverlay = () => {
  const { progress, isLoading, isComplete } = useAssetPreloader();
  const [visible, setVisible] = useState(true);

  // Hide 5 seconds after completion
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  if (!visible) return null;

  const filledBlocks = Math.round((progress / 100) * 10);
  const bar = "█".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] pointer-events-none"
      style={{ fontFamily: "'Press Start 2P', monospace" }}
    >
      <div className="flex items-center gap-2" style={{ fontSize: "7px" }}>
        <span style={{ color: "hsl(142, 50%, 45%)", letterSpacing: "1px" }}>
          {isComplete ? "ALL ASSETS LOADED" : "LOADING ASSETS"}
        </span>
        {!isComplete && (
          <>
            <span style={{ color: "hsl(142, 60%, 40%)", letterSpacing: "1px" }}>
              [{bar}]
            </span>
            <span style={{ color: "hsl(0, 0%, 55%)" }}>
              {progress}%
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default AssetLoadingOverlay;
