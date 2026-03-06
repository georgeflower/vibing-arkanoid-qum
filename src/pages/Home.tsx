import { useState, useEffect } from "react";
import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";
import { Link } from "react-router-dom";
import CRTOverlay from "@/components/CRTOverlay";
import { GAME_VERSION } from "@/constants/version";
import { CHANGELOG } from "@/constants/version";
import { supabase } from "@/integrations/supabase/client";
import startScreen from "@/assets/start-screen-new.webp";

// Power-up images
import powerupFireball from "@/assets/powerup-fireball.png";
import powerupMultiball from "@/assets/powerup-multiball.png";
import powerupExtend from "@/assets/powerup-extend.png";
import powerupLife from "@/assets/powerup-life.png";
import powerupShield from "@/assets/powerup-shield.png";
import powerupBarrier from "@/assets/powerup-barrier.png";
import powerupSlowdown from "@/assets/powerup-slowdown.png";
import powerupTurrets from "@/assets/powerup-turrets.png";
import powerupStunner from "@/assets/powerup-stunner.png";
import powerupReflect from "@/assets/powerup-reflect.png";
import powerupHoming from "@/assets/powerup-homing.png";
import powerupShrink from "@/assets/powerup-shrink.png";

// Bonus letter images
import bonusQ from "@/assets/bonus-q.png";
import bonusU from "@/assets/bonus-u.png";
import bonusM from "@/assets/bonus-m.png";
import bonusR from "@/assets/bonus-r.png";
import bonusA from "@/assets/bonus-a.png";
import bonusN from "@/assets/bonus-n.png";

const powerUps = [
  { img: powerupFireball, name: "Fireball", desc: "Burns through bricks" },
  { img: powerupMultiball, name: "Multi-Ball", desc: "Splits into 3 balls" },
  { img: powerupExtend, name: "Extend", desc: "Widens the paddle" },
  { img: powerupLife, name: "Extra Life", desc: "+1 life" },
  { img: powerupShield, name: "Shield", desc: "Energy force field" },
  { img: powerupBarrier, name: "Barrier", desc: "Safety net below" },
  { img: powerupSlowdown, name: "Slow Down", desc: "Reduces ball speed" },
  { img: powerupTurrets, name: "Turrets", desc: "Paddle-mounted guns" },
  { img: powerupStunner, name: "Stunner", desc: "Freezes boss 5s" },
  { img: powerupReflect, name: "Reflect", desc: "Reflects boss attacks" },
  { img: powerupHoming, name: "Homing", desc: "Ball tracks boss" },
  { img: powerupShrink, name: "Shrink", desc: "Shrinks paddle" },
];

const bonusLetters = [
  { img: bonusQ, letter: "Q" },
  { img: bonusU, letter: "U" },
  { img: bonusM, letter: "M" },
  { img: bonusR, letter: "R" },
  { img: bonusA, letter: "A" },
  { img: bonusN, letter: "N" },
];

const tips = [
  {
    title: "Paddle Edges",
    tip: "Hit the ball with paddle edges for sharp angles — great for reaching tricky corners.",
  },
  { title: "Boss Patterns", tip: "Learn each boss's attack pattern. Dodge first, attack when safe." },
  { title: "Q-U-M-R-A-N", tip: "Collect all 6 bonus letters for 5 extra lives. They fall from certain bricks!" },
  { title: "Save Turrets", tip: "Turrets persist across levels and stack ammo. Use them wisely on bosses." },
  { title: "Reflect Shield", tip: "Reflect Shield turns boss attacks against them. Devastating on later bosses." },
  { title: "Boss Rush", tip: "Practice Boss Rush mode to master all 4 bosses back-to-back." },
];

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="retro-pixel-text text-center mb-8"
    style={{
      fontSize: "clamp(14px, 3vw, 24px)",
      background: "linear-gradient(90deg, hsl(200,70%,50%), hsl(330,100%,65%), hsl(30,100%,60%))",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    }}
  >
    {children}
  </h2>
);

type LeaderboardTab = "all-time" | "weekly" | "daily";
type DifficultyTab = "all" | "normal" | "godlike";

interface ScoreEntry {
  name: string;
  score: number;
  level: number;
  difficulty?: string;
  gameMode?: string;
}

const Home = () => {
  useServiceWorkerUpdate({ isMainMenu: true, shouldApplyUpdate: true });
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>("all-time");
  const [difficultyTab, setDifficultyTab] = useState<DifficultyTab>("all");
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [scoresLoading, setScoresLoading] = useState(true);

  useEffect(() => {
    const fetchScores = async () => {
      setScoresLoading(true);
      try {
        let query = supabase
          .from("high_scores")
          .select("player_name, score, level, difficulty, game_mode")
          .order("score", { ascending: false })
          .limit(10);

        if (difficultyTab === "godlike") {
          query = query.eq("difficulty", "godlike");
        } else if (difficultyTab === "normal") {
          query = query.or("difficulty.is.null,difficulty.neq.godlike");
        }

        if (leaderboardTab === "weekly") {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          query = query.gte("created_at", weekAgo.toISOString());
        } else if (leaderboardTab === "daily") {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          query = query.gte("created_at", today.toISOString());
        }

        const { data } = await query;
        setScores(
          (data || []).map((r) => ({
            name: r.player_name,
            score: r.score,
            level: r.level,
            difficulty: r.difficulty || undefined,
            gameMode: r.game_mode || undefined,
          }))
        );
      } catch {
        setScores([]);
      } finally {
        setScoresLoading(false);
      }
    };
    fetchScores();
  }, [leaderboardTab, difficultyTab]);
  return (
    <div
      className="relative"
      style={{
        background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)",
        overflowY: "auto",
        height: "100vh",
        position: "fixed",
        inset: 0,
        zIndex: 50,
      }}
    >
      <CRTOverlay quality="medium" />

      {/* Scrollable content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8" style={{ minHeight: "100vh" }}>
        {/* ===== HERO ===== */}
        <section className="amiga-box rounded-lg p-6 sm:p-10 mb-12 text-center relative overflow-hidden">
          {/* Background image */}
          <div className="absolute inset-0 opacity-20">
            <img src={startScreen} alt="" className="w-full h-full object-cover" style={{ imageRendering: "auto" }} />
          </div>

          <div className="relative z-10">
            <h1
              className="retro-pixel-text mb-4"
              style={{
                fontSize: "clamp(20px, 5vw, 48px)",
                background:
                  "linear-gradient(90deg, hsl(200,70%,50%), hsl(330,100%,65%), hsl(30,100%,60%), hsl(200,70%,50%))",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "retro-shine 3s linear infinite",
              }}
            >
              VIBING ARKANOID
            </h1>

            <p
              className="retro-pixel-text mb-8"
              style={{
                fontSize: "clamp(8px, 1.8vw, 14px)",
                color: "hsl(0,0%,75%)",
              }}
            >
              A loving tribute to the legendary Arkanoid
            </p>

            <Link
              to="/play"
              className="inline-block retro-pixel-text retro-button px-8 py-4 rounded"
              style={{
                fontSize: "clamp(12px, 2.5vw, 20px)",
                background: "linear-gradient(180deg, hsl(200,70%,50%) 0%, hsl(200,70%,35%) 100%)",
                border: "3px ridge hsl(200,70%,60%)",
                color: "hsl(0,0%,100%)",
                textDecoration: "none",
              }}
            >
              ▶ PLAY NOW
            </Link>
          </div>
        </section>

        {/* ===== TRIBUTE ===== */}
        <section className="amiga-box rounded-lg p-6 sm:p-8 mb-10">
          <SectionTitle>A Tribute to Arkanoid</SectionTitle>
          <div
            className="space-y-4"
            style={{ color: "hsl(0,0%,78%)", fontSize: "clamp(9px, 1.5vw, 13px)", lineHeight: 1.8 }}
          >
            <p className="retro-pixel-text">
              In 1986, Taito released <span style={{ color: "hsl(30,100%,60%)" }}>Arkanoid</span> — a breakout-style
              arcade game that became an instant classic and one of the most influential games ever made.
            </p>
            <p className="retro-pixel-text">
              Vibing Arkanoid is a heartfelt tribute to that legendary game. We've reimagined the brick-breaking formula
              with 20 challenging levels, epic boss battles, 12 unique power-ups, a dual power-up choice system, and an
              authentic retro Amiga aesthetic — all running in your browser.
            </p>
            <p className="retro-pixel-text">
              The original Arkanoid's DNA is everywhere: the satisfying physics, the strategic power-up choices — including
              dual drops where you pick one of two power-ups — the "just one more level" pull. We hope Taito would approve.
            </p>
          </div>
        </section>

        {/* ===== GAMEPLAY ===== */}
        <section className="amiga-box rounded-lg p-6 sm:p-8 mb-10">
          <SectionTitle>Gameplay</SectionTitle>

          <div
            className="space-y-6"
            style={{ color: "hsl(0,0%,78%)", fontSize: "clamp(9px, 1.5vw, 13px)", lineHeight: 1.8 }}
          >
            <p className="retro-pixel-text">
              Battle through <span style={{ color: "hsl(200,70%,50%)" }}>20 levels</span> of increasing difficulty. Face
              epic <span style={{ color: "hsl(0,85%,55%)" }}>boss battles</span> on levels 5, 10, 15, and the ultimate
              Mega Boss on level 20 — featuring 3 phases, cross projectiles that merge into larger spheres,
              music-reactive background visuals, and a danger ball reflect mechanic.
            </p>
            <p className="retro-pixel-text">
              Encounter special brick types: <span style={{ color: "hsl(0,0%,60%)" }}>Metal</span> (indestructible),{" "}
              <span style={{ color: "hsl(30,100%,60%)" }}>Cracked</span> (3 hits), and{" "}
              <span style={{ color: "hsl(0,85%,55%)" }}>Explosive</span> (chain reactions).
            </p>
          </div>

          {/* Power-ups grid */}
          <h3
            className="retro-pixel-text text-center mt-8 mb-4"
            style={{ fontSize: "clamp(10px, 2vw, 16px)", color: "hsl(330,100%,65%)" }}
          >
            12 Power-Ups
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {powerUps.map((pu) => (
              <div
                key={pu.name}
                className="flex flex-col items-center p-2 rounded"
                style={{
                  background: "hsl(210,20%,16%)",
                  border: "2px inset hsl(210,15%,40%)",
                }}
              >
                <img
                  src={pu.img}
                  alt={pu.name}
                  className="w-8 h-8 sm:w-10 sm:h-10 mb-1"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="retro-pixel-text text-center" style={{ fontSize: "7px", color: "hsl(200,70%,50%)" }}>
                  {pu.name}
                </span>
                <span className="retro-pixel-text text-center" style={{ fontSize: "6px", color: "hsl(0,0%,55%)" }}>
                  {pu.desc}
                </span>
              </div>
            ))}
          </div>

          {/* Bonus letters */}
          <h3
            className="retro-pixel-text text-center mt-8 mb-4"
            style={{ fontSize: "clamp(10px, 2vw, 16px)", color: "hsl(30,100%,60%)" }}
          >
            Collect Q-U-M-R-A-N
          </h3>
          <div className="flex justify-center gap-3">
            {bonusLetters.map((bl) => (
              <div
                key={bl.letter}
                className="flex flex-col items-center p-2 rounded"
                style={{
                  background: "hsl(210,20%,16%)",
                  border: "2px inset hsl(210,15%,40%)",
                }}
              >
                <img
                  src={bl.img}
                  alt={bl.letter}
                  className="w-8 h-8 sm:w-10 sm:h-10"
                  style={{ imageRendering: "pixelated", aspectRatio: "1 / 1", objectFit: "contain" }}
                />
              </div>
            ))}
          </div>
          <p className="retro-pixel-text text-center mt-2" style={{ fontSize: "8px", color: "hsl(0,0%,60%)" }}>
            Collect all 6 letters for 5 extra lives!
          </p>
        </section>

        {/* ===== RULES ===== */}
        <section className="amiga-box rounded-lg p-6 sm:p-8 mb-10">
          <SectionTitle>Rules</SectionTitle>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div
              className="p-4 rounded"
              style={{ background: "hsl(210,20%,16%)", border: "2px inset hsl(210,15%,40%)" }}
            >
              <h4 className="retro-pixel-text mb-3" style={{ fontSize: "10px", color: "hsl(200,70%,50%)" }}>
                Controls
              </h4>
              <ul className="space-y-2" style={{ fontSize: "8px", color: "hsl(0,0%,70%)" }}>
                <li className="retro-pixel-text">🖱️ Mouse — move paddle</li>
                <li className="retro-pixel-text">📱 Touch — drag to move</li>
                <li className="retro-pixel-text">Click/Touch — launch ball / shoot</li>
                <li className="retro-pixel-text">ESC / P — pause menu</li>
                <li className="retro-pixel-text">F — toggle fullscreen</li>
              </ul>
            </div>

            {/* Objective */}
            <div
              className="p-4 rounded"
              style={{ background: "hsl(210,20%,16%)", border: "2px inset hsl(210,15%,40%)" }}
            >
              <h4 className="retro-pixel-text mb-3" style={{ fontSize: "10px", color: "hsl(200,70%,50%)" }}>
                Objective
              </h4>
              <ul className="space-y-2" style={{ fontSize: "8px", color: "hsl(0,0%,70%)" }}>
                <li className="retro-pixel-text">Break all bricks to advance</li>
                <li className="retro-pixel-text">Defeat bosses on levels 5, 10, 15 & 20</li>
                <li className="retro-pixel-text">Don't let the ball fall!</li>
                <li className="retro-pixel-text">Collect power-ups for advantages</li>
              </ul>
            </div>

            {/* Difficulty */}
            <div
              className="p-4 rounded"
              style={{ background: "hsl(210,20%,16%)", border: "2px inset hsl(210,15%,40%)" }}
            >
              <h4 className="retro-pixel-text mb-3" style={{ fontSize: "10px", color: "hsl(330,100%,65%)" }}>
                Difficulty Modes
              </h4>
              <ul className="space-y-2" style={{ fontSize: "8px", color: "hsl(0,0%,70%)" }}>
                <li className="retro-pixel-text">
                  <span style={{ color: "hsl(120,50%,50%)" }}>Normal</span> — 3 lives, balanced speed
                </li>
                <li className="retro-pixel-text">
                  <span style={{ color: "hsl(0,85%,55%)" }}>Godlike</span> — 1 life, faster speed
                </li>
              </ul>
            </div>

            {/* Game Modes */}
            <div
              className="p-4 rounded"
              style={{ background: "hsl(210,20%,16%)", border: "2px inset hsl(210,15%,40%)" }}
            >
              <h4 className="retro-pixel-text mb-3" style={{ fontSize: "10px", color: "hsl(330,100%,65%)" }}>
                Game Modes
              </h4>
              <ul className="space-y-2" style={{ fontSize: "8px", color: "hsl(0,0%,70%)" }}>
                <li className="retro-pixel-text">
                  <span style={{ color: "hsl(200,70%,50%)" }}>Normal</span> — 20 levels + bosses
                </li>
                <li className="retro-pixel-text">
                  <span style={{ color: "hsl(0,85%,55%)" }}>Boss Rush</span> — All 4 bosses back-to-back
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ===== BEST TIPS ===== */}
        <section className="amiga-box rounded-lg p-6 sm:p-8 mb-10">
          <SectionTitle>Best Tips</SectionTitle>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tips.map((t) => (
              <div
                key={t.title}
                className="p-4 rounded"
                style={{
                  background: "linear-gradient(135deg, hsl(210,20%,18%) 0%, hsl(210,20%,14%) 100%)",
                  border: "2px ridge hsl(210,15%,40%)",
                  borderTopColor: "hsl(210,15%,50%)",
                  borderLeftColor: "hsl(210,15%,50%)",
                }}
              >
                <h4 className="retro-pixel-text mb-2" style={{ fontSize: "9px", color: "hsl(30,100%,60%)" }}>
                  ★ {t.title}
                </h4>
                <p className="retro-pixel-text" style={{ fontSize: "8px", color: "hsl(0,0%,70%)", lineHeight: 1.8 }}>
                  {t.tip}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== HIGH SCORES ===== */}
        <section className="amiga-box rounded-lg p-6 sm:p-8 mb-10">
          <SectionTitle>High Scores</SectionTitle>

          {/* Leaderboard tabs */}
          <div className="flex justify-center gap-2 mb-3">
            {(["all-time", "weekly", "daily"] as LeaderboardTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeaderboardTab(tab)}
                className="retro-pixel-text px-3 py-1 rounded transition-colors"
                style={{
                  fontSize: "9px",
                  background: leaderboardTab === tab ? "hsl(200,70%,50%)" : "hsl(210,20%,20%)",
                  color: leaderboardTab === tab ? "hsl(0,0%,100%)" : "hsl(0,0%,60%)",
                  border: `2px solid ${leaderboardTab === tab ? "hsl(200,70%,60%)" : "hsl(210,15%,35%)"}`,
                }}
              >
                {tab === "all-time" ? "ALL TIME" : tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Difficulty filter */}
          <div className="flex justify-center gap-2 mb-5">
            {(["all", "normal", "godlike"] as DifficultyTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setDifficultyTab(tab)}
                className="retro-pixel-text px-3 py-1 rounded transition-colors"
                style={{
                  fontSize: "8px",
                  background: difficultyTab === tab ? "hsl(330,100%,45%)" : "hsl(210,20%,16%)",
                  color: difficultyTab === tab ? "hsl(0,0%,100%)" : "hsl(0,0%,55%)",
                  border: `2px solid ${difficultyTab === tab ? "hsl(330,100%,55%)" : "hsl(210,15%,30%)"}`,
                }}
              >
                {tab === "godlike" ? "GOD-MODE" : tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Scores list */}
          <div
            className="rounded p-3"
            style={{ background: "hsl(210,20%,12%)", border: "2px inset hsl(210,15%,40%)" }}
          >
            {scoresLoading ? (
              <p className="retro-pixel-text text-center" style={{ fontSize: "9px", color: "hsl(0,0%,50%)" }}>
                Loading...
              </p>
            ) : scores.length === 0 ? (
              <p className="retro-pixel-text text-center" style={{ fontSize: "9px", color: "hsl(0,0%,45%)" }}>
                No scores yet!
              </p>
            ) : (
              <div className="space-y-1">
                {scores.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2 py-1 rounded"
                    style={{
                      background: i === 0 ? "hsl(45,80%,15%)" : i % 2 === 0 ? "hsl(210,15%,14%)" : "transparent",
                    }}
                  >
                    <span
                      className="retro-pixel-text w-5 text-right"
                      style={{ fontSize: "9px", color: i === 0 ? "hsl(45,90%,60%)" : "hsl(200,70%,50%)" }}
                    >
                      {i + 1}.
                    </span>
                    <span className="retro-pixel-text flex-1 flex items-center gap-1" style={{ fontSize: "9px" }}>
                      <span style={{ color: "hsl(330,100%,65%)" }}>{entry.name}</span>
                      {entry.difficulty === "godlike" && (
                        <span style={{ fontSize: "7px", color: "hsl(0,85%,55%)" }}>GOD</span>
                      )}
                      {entry.gameMode === "boss_rush" && (
                        <span style={{ fontSize: "7px", color: "hsl(30,100%,60%)" }}>BOSS RUSH</span>
                      )}
                    </span>
                    <span
                      className="retro-pixel-text"
                      style={{ fontSize: "9px", color: "hsl(45,90%,60%)" }}
                    >
                      {entry.score.toLocaleString()}
                    </span>
                    <span
                      className="retro-pixel-text w-10 text-right"
                      style={{ fontSize: "8px", color: "hsl(280,60%,55%)" }}
                    >
                      LV{entry.level}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="retro-pixel-text text-center mt-3" style={{ fontSize: "7px", color: "hsl(0,0%,45%)" }}>
            Top 10 scores shown
          </p>
        </section>

        {/* ===== CHANGELOG ===== */}
        <section className="amiga-box rounded-lg p-6 sm:p-8 mb-10">
          <SectionTitle>Changelog</SectionTitle>

          <div className="space-y-5" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {CHANGELOG.map((entry) => (
              <div
                key={entry.version}
                className="p-4 rounded"
                style={{
                  background: "hsl(210,20%,16%)",
                  border: "2px inset hsl(210,15%,40%)",
                  borderLeftWidth: "4px",
                  borderLeftColor: "hsl(200,70%,50%)",
                }}
              >
                <h4
                  className="retro-pixel-text mb-2"
                  style={{ fontSize: "clamp(9px, 1.8vw, 13px)", color: "hsl(30,100%,60%)" }}
                >
                  v{entry.version}
                </h4>
                <ul className="space-y-1">
                  {entry.changes.map((change, idx) => (
                    <li
                      key={idx}
                      className="retro-pixel-text"
                      style={{ fontSize: "clamp(7px, 1.3vw, 10px)", color: "hsl(0,0%,70%)", lineHeight: 1.7 }}
                    >
                      • {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ===== OPEN SOURCE ===== */}
        <section className="amiga-box rounded-lg p-6 sm:p-8 mb-10 text-center">
          <SectionTitle>Open Source</SectionTitle>

          <div
            className="space-y-4"
            style={{ color: "hsl(0,0%,78%)", fontSize: "clamp(9px, 1.5vw, 12px)", lineHeight: 1.8 }}
          >
            <p className="retro-pixel-text">
              Vibing Arkanoid is <span style={{ color: "hsl(120,50%,50%)" }}>100% open source</span> and proudly{" "}
              <span style={{ color: "hsl(330,100%,65%)" }}>vibe coded</span>.
            </p>
            <p className="retro-pixel-text">Explore the code, report issues, or contribute on GitHub!</p>
          </div>

          <a
            href="https://github.com/georgeflower/vibing-arkanoid"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 retro-pixel-text retro-button mt-6 px-6 py-3 rounded"
            style={{
              fontSize: "clamp(10px, 2vw, 14px)",
              background: "linear-gradient(180deg, hsl(0,0%,25%) 0%, hsl(0,0%,18%) 100%)",
              border: "3px ridge hsl(0,0%,40%)",
              color: "hsl(0,0%,90%)",
              textDecoration: "none",
            }}
          >
            <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            View on GitHub
          </a>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="text-center py-8 space-y-3">
          <p className="retro-pixel-text" style={{ fontSize: "8px", color: "hsl(0,0%,50%)" }}>
            Created by Qumran • v{GAME_VERSION}
          </p>
          <Link
            to="/play"
            className="retro-pixel-text inline-block"
            style={{ fontSize: "10px", color: "hsl(200,70%,50%)", textDecoration: "none" }}
          >
            ▶ Launch Game
          </Link>
        </footer>
      </div>
    </div>
  );
};

export default Home;
