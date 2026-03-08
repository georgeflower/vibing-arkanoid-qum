import { Link } from "react-router-dom";
import CRTOverlay from "@/components/CRTOverlay";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6">
    <h2 className="retro-pixel-text mb-3" style={{ fontSize: "14px", color: "hsl(200, 70%, 50%)" }}>{title}</h2>
    <div className="space-y-2 text-sm leading-relaxed" style={{ color: "hsl(0,0%,75%)" }}>{children}</div>
  </div>
);

const PrivacyPolicy = () => (
  <div className="min-h-screen" style={{ background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)", overflowY: "auto", height: "100vh", position: "fixed", inset: 0 }}>
    <CRTOverlay quality="medium" />
    <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
      <div className="amiga-box rounded-lg p-6 sm:p-8">
        <h1 className="retro-pixel-text text-center mb-8" style={{ fontSize: "24px", color: "hsl(200, 70%, 50%)", textShadow: "0 0 10px hsl(200,70%,50%,0.5)" }}>
          PRIVACY POLICY
        </h1>
        <p className="text-xs mb-6" style={{ color: "hsl(0,0%,50%)" }}>Last updated: March 2026</p>

        <Section title="1. WHAT DATA WE COLLECT">
          <p>We collect only the minimum data needed to run Vibing Arkanoid:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li><strong>Email address</strong> — used for account login and verification</li>
            <li><strong>Username & display name</strong> — shown on your profile and leaderboards</li>
            <li><strong>Initials</strong> — displayed on high score tables</li>
            <li><strong>Hashed password</strong> — your password is never stored in plain text; we use bcrypt with salt</li>
            <li><strong>Game stats</strong> — scores, achievements, play time, etc.</li>
          </ul>
        </Section>

        <Section title="2. WHY WE COLLECT IT">
          <p>Your data is collected solely to:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>Authenticate your account securely</li>
            <li>Display your profile and stats</li>
            <li>Show your scores on leaderboards</li>
            <li>Track gameplay achievements</li>
          </ul>
        </Section>

        <Section title="3. HOW DATA IS STORED & PROTECTED">
          <p>All data is stored in encrypted databases hosted on secure cloud infrastructure. Passwords are hashed using industry-standard bcrypt. All communication uses HTTPS encryption. We use JWT tokens with short expiration for session management.</p>
        </Section>

        <Section title="4. DATA RETENTION">
          <p>Your account data is kept for as long as your account exists. If you delete your account, all associated data (profile, stats, scores) will be permanently removed within 30 days.</p>
        </Section>

        <Section title="5. REQUESTING DATA DELETION">
          <p>You can request deletion of your account and all associated data by contacting us or using the account deletion feature in your profile settings. We will process deletion requests within 30 days.</p>
        </Section>

        <Section title="6. THIRD-PARTY SERVICES">
          <p>We use the following third-party services:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li><strong>Cloud hosting</strong> — for database and authentication services</li>
            <li><strong>Email provider</strong> — for sending verification and password reset emails</li>
          </ul>
          <p className="mt-2">We do not share, sell, or rent your personal data to any third parties for marketing purposes.</p>
        </Section>

        <Section title="7. COOKIES">
          <p>We use essential cookies only for authentication sessions. We do not use tracking cookies or analytics that identify individual users.</p>
        </Section>

        <Section title="8. YOUR RIGHTS">
          <p>You have the right to access, correct, or delete your personal data at any time through your profile page or by contacting us.</p>
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
