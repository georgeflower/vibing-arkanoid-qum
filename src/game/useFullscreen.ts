/**
 * game/useFullscreen.ts — Fullscreen management for desktop and mobile.
 *
 * Extracted from Game.tsx to reduce component size.
 * Handles: toggle, auto-enter, F key, iOS gesture prevention, fullscreen change events.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { GameState } from "@/types/game";
import { debugToast as toast } from "@/utils/debugToast";
import type { FixedStepGameLoop } from "@/utils/gameLoop";

interface FullscreenDeps {
  isMobileDevice: boolean;
  isIOSDevice: boolean;
  gameState: GameState;
  setGameState: (state: GameState) => void;
  gameLoopRef: React.MutableRefObject<FixedStepGameLoop | null>;
}

export function useFullscreen(deps: FullscreenDeps) {
  const { isMobileDevice, isIOSDevice, gameState, setGameState, gameLoopRef } = deps;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const isTogglingFullscreenRef = useRef(false);
  const hasAutoFullscreenedRef = useRef(false);

  const toggleFullscreen = useCallback(async () => {
    if (!fullscreenContainerRef.current) return;

    isTogglingFullscreenRef.current = true;

    if (isIOSDevice) {
      const entering = !isFullscreen;
      setIsFullscreen(entering);

      if (entering) {
        window.scrollTo(0, 0);
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.width = "100%";
        document.body.style.height = "100%";
      } else {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
      }

      setTimeout(() => {
        isTogglingFullscreenRef.current = false;
      }, 500);
      return;
    }

    try {
      if (!document.fullscreenElement) {
        if (fullscreenContainerRef.current.requestFullscreen) {
          await fullscreenContainerRef.current.requestFullscreen();
        } else if ((fullscreenContainerRef.current as any).webkitRequestFullscreen) {
          await (fullscreenContainerRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }

    setTimeout(() => {
      isTogglingFullscreenRef.current = false;
    }, 500);
  }, [isIOSDevice, isFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    if (isIOSDevice) return;

    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement || !!(document as any).webkitFullscreenElement;
      setIsFullscreen(isNowFullscreen);

      if (isMobileDevice && !isNowFullscreen && gameState === "playing") {
        setGameState("paused");
        if (gameLoopRef.current) {
          gameLoopRef.current.pause();
        }
        setShowFullscreenPrompt(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [isMobileDevice, gameState, isIOSDevice, setGameState, gameLoopRef]);

  // Auto-enter fullscreen when game starts
  useEffect(() => {
    const shouldAutoFullscreen =
      !isIOSDevice &&
      gameState === "ready" &&
      !isFullscreen &&
      !hasAutoFullscreenedRef.current &&
      fullscreenContainerRef.current;

    if (shouldAutoFullscreen) {
      hasAutoFullscreenedRef.current = true;
      const timer = setTimeout(() => {
        toggleFullscreen();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMobileDevice, isIOSDevice, gameState, isFullscreen, toggleFullscreen]);

  // F key to toggle fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFullscreen]);

  // iOS Safari: Document-level gesture prevention
  useEffect(() => {
    if (!isIOSDevice) return;
    if (gameState !== "playing" && gameState !== "ready") return;

    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
    };
  }, [isIOSDevice, gameState]);

  const handleFullscreenPromptClick = useCallback(async () => {
    setShowFullscreenPrompt(false);
    await toggleFullscreen();
    setGameState("playing");
    if (gameLoopRef.current) {
      gameLoopRef.current.resume();
    }
  }, [toggleFullscreen, setGameState, gameLoopRef]);

  return {
    isFullscreen,
    setIsFullscreen,
    showFullscreenPrompt,
    setShowFullscreenPrompt,
    fullscreenContainerRef,
    isTogglingFullscreenRef,
    hasAutoFullscreenedRef,
    toggleFullscreen,
    handleFullscreenPromptClick,
  };
}
