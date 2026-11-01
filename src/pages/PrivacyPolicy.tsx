import { Link } from "react-router-dom";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6">
    <h2 className="retro-pixel-text mb-3" style={{ fontSize: "14px", color: "hsl(200, 70%, 50%)" }}>{title}</h2>
    <div className="space-y-2 text-sm leading-relaxed" style={{ color: "hsl(0,0%,75%)" }}>{children}</div>
  </div>
);

const PrivacyPolicy = () => (
  <div className="min-h-screen" style={{ background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)", overflowY: "auto", height: "100vh", position: "fixed", inset: 0 }}>
    <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
      <div className="amiga-box rounded-lg p-6 sm:p-8">
        <h1 className="retro-pixel-text text-center mb-8" style={{ fontSize: "24px", color: "hsl(200, 70%, 50%)", textShadow: "0 0 10px hsl(200,70%,50%,0.5)" }}>
          PRIVACY POLICY
        </h1>
        <p className="text-xs mb-6" style={{ color: "hsl(0,0%,50%)" }}>Last updated: November 2026</p>

        <Section title="1. WHAT DATA WE COLLECT">
          <p>Vibing Arkanoid has no accounts, no logins and no email addresses. The only data stored on our servers is what you choose to submit to the public leaderboard:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li><strong>Initials</strong> — up to 3 letters you type in when you reach a high score</li>
            <li><strong>Score details</strong> — score, level reached, difficulty / game mode and the time of submission</li>
          </ul>
          <p className="mt-2">To prevent spam, when you submit a score a one-way hash of your IP address is kept for about an hour to limit how often scores can be submitted. Your IP address itself is not stored with your score.</p>
        </Section>

        <Section title="2. WHAT STAYS IN YOUR BROWSER">
          <p>Your game settings (sound, video quality, music source) and the highest level you have unlocked are saved in your browser's local storage on your own device. They are never sent to us.</p>
        </Section>

        <Section title="3. ANALYTICS & COOKIES">
          <p>We do not use analytics, tracking, advertising or tracking cookies.</p>
        </Section>

        <Section title="4. DATA RETENTION & REMOVAL">
          <p>Leaderboard entries are kept until they are removed. Because entries are anonymous, we cannot tell whose entry is whose. If you want an entry removed, contact us through the project's GitHub repository and tell us the initials, score and approximate date.</p>
        </Section>

        <Section title="5. THIRD-PARTY SERVICES">
          <ul className="list-disc ml-4 space-y-1">
            <li><strong>Cloudflare</strong> (Workers and D1) — runs the leaderboard service and database; the game itself is hosted on Nekoweb</li>
            <li><strong>Google Fonts</strong> — used to load the game's fonts</li>
            <li><strong>Nectarine Radio</strong> (nectarine.inversi0n.org / scenestream.net) — the radio stream and "now playing" information. When you play the radio, your browser connects to the stream like any other web radio, and that service sees your IP address.</li>
          </ul>
          <p className="mt-2">We do not share, sell, or rent any data to third parties for marketing purposes.</p>
        </Section>

        <Section title="6. QUESTIONS">
          <p>For any question about this policy, open an issue in the project's GitHub repository.</p>
        </Section>

        <div className="flex justify-center gap-3 mt-8">
          <Link to="/" className="px-4 py-2 rounded text-sm font-bold" style={{ background: "hsl(200, 70%, 50%)", color: "white" }}>HOME</Link>
          <Link to="/terms" className="px-4 py-2 rounded text-sm font-bold" style={{ background: "hsl(0,0%,25%)", color: "hsl(0,0%,80%)", border: "1px solid hsl(0,0%,35%)" }}>TERMS</Link>
        </div>
      </div>
    </div>
  </div>
);

export default PrivacyPolicy;
