import { useEffect, useState } from "react";
import { ACHIEVEMENTS } from "@/constants/achievements";

interface AchievementNotificationProps {
  achievementIds: string[];
  onComplete: () => void;
}

interface NotificationState {
  id: string;
  phase: "enter" | "visible" | "exit" | "done";
}

export const AchievementNotification = ({
  achievementIds,
  onComplete,
}: AchievementNotificationProps) => {
  const [notifications, setNotifications] = useState<NotificationState[]>([]);

  useEffect(() => {
    if (achievementIds.length === 0) return;

    // Stagger notifications with 1.2s delay between each
    achievementIds.forEach((id, index) => {
      const delay = index * 1200;

      setTimeout(() => {
        setNotifications((prev) => [...prev, { id, phase: "enter" }]);

        // Transition to visible after enter animation
        setTimeout(() => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, phase: "visible" } : n))
          );
        }, 400);

        // Start exit after 4s visible
        setTimeout(() => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, phase: "exit" } : n))
          );
        }, 4000);

        // Remove after exit animation
        setTimeout(() => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, phase: "done" } : n))
          );
        }, 4600);
      }, delay);
    });

    // Call onComplete after all notifications are done
    const totalTime = (achievementIds.length - 1) * 1200 + 4600 + 200;
    const timer = setTimeout(onComplete, totalTime);
    return () => clearTimeout(timer);
  }, []);

  const activeNotifications = notifications.filter((n) => n.phase !== "done");
  if (activeNotifications.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
        gap: "8px",
        paddingTop: "16px",
      }}
    >
      {activeNotifications.map((notification) => {
        const achievement = ACHIEVEMENTS.find((a) => a.id === notification.id);
        if (!achievement) return null;

        const opacity =
          notification.phase === "enter"
            ? 0
            : notification.phase === "exit"
            ? 0
            : 1;
        const translateY =
          notification.phase === "enter"
            ? -60
            : notification.phase === "exit"
            ? -40
            : 0;

        return (
          <div
            key={notification.id}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
              background: "linear-gradient(180deg, hsl(40, 60%, 8%) 0%, hsl(30, 50%, 5%) 100%)",
              border: "2px solid hsl(45, 100%, 50%)",
              borderRadius: "4px",
              padding: "12px 20px",
              minWidth: "280px",
              maxWidth: "400px",
              boxShadow:
                "0 0 20px hsla(45, 100%, 50%, 0.4), 0 0 40px hsla(45, 100%, 50%, 0.15), inset 0 1px 0 hsla(45, 100%, 70%, 0.2)",
              textAlign: "center",
              imageRendering: "pixelated" as React.CSSProperties["imageRendering"],
            }}
          >
            <div
              style={{
                fontSize: "10px",
                letterSpacing: "3px",
                color: "hsl(45, 100%, 65%)",
                marginBottom: "6px",
                textTransform: "uppercase",
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                textShadow: "0 0 8px hsla(45, 100%, 50%, 0.6)",
              }}
            >
              Achievement Unlocked
            </div>
            <div
              style={{
                fontSize: "28px",
                marginBottom: "4px",
                filter: "drop-shadow(0 0 4px hsla(45, 100%, 50%, 0.5))",
              }}
            >
              {achievement.icon}
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "bold",
                color: "hsl(45, 100%, 80%)",
                marginBottom: "2px",
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                textShadow: "0 0 6px hsla(45, 100%, 50%, 0.4)",
              }}
            >
              {achievement.name}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "hsl(40, 30%, 60%)",
                fontFamily: "'Press Start 2P', 'Courier New', monospace",
                lineHeight: "1.4",
              }}
            >
              {achievement.description}
            </div>
          </div>
        );
      })}
    </div>
  );
};
