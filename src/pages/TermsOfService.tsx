import { Link } from "react-router-dom";
import CRTOverlay from "@/components/CRTOverlay";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6">
    <h2 className="retro-pixel-text mb-3" style={{ fontSize: "14px", color: "hsl(200, 70%, 50%)" }}>{title}</h2>
    <div className="space-y-2 text-sm leading-relaxed" style={{ color: "hsl(0,0%,75%)" }}>{children}</div>
  </div>
);

const TermsOfService = () => (
  <div className="min-h-screen" style={{ background: "linear-gradient(180deg, hsl(220,25%,12%) 0%, hsl(220,30%,8%) 100%)", overflowY: "auto", height: "100vh", position: "fixed", inset: 0 }}>
    <CRTOverlay quality="medium" />
    <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
      <div className="amiga-box rounded-lg p-6 sm:p-8">
        <h1 className="retro-pixel-text text-center mb-8" style={{ fontSize: "24px", color: "hsl(200, 70%, 50%)", textShadow: "0 0 10px hsl(200,70%,50%,0.5)" }}>
          TERMS OF SERVICE
        </h1>
        <p className="text-xs mb-6" style={{ color: "hsl(0,0%,50%)" }}>Last updated: March 2026</p>

        <Section title="1. ACCEPTANCE">
          <p>By creating an account or using Vibing Arkanoid, you agree to these Terms of Service. If you don't agree, please don't use the service.</p>
        </Section>

        <Section title="2. ACCOUNT RULES">
          <ul className="list-disc ml-4 space-y-1">
            <li>You must provide a valid email address</li>
            <li>You are responsible for keeping your password secure</li>
            <li>One account per person — no duplicate or shared accounts</li>
            <li>You must not use offensive or impersonating usernames</li>
            <li>Don't share your login credentials with anyone</li>
          </ul>
        </Section>

        <Section title="3. AGE REQUIREMENTS">
          <p>You must be at least 13 years old to create an account. If you are under 18, you should have parental or guardian consent to use this service.</p>
        </Section>

        <Section title="4. USER RESPONSIBILITIES">
          <ul className="list-disc ml-4 space-y-1">
            <li>Play fair — no cheating, hacking, or exploiting bugs for unfair advantage</li>
            <li>Don't submit fake or manipulated high scores</li>
            <li>Don't attempt to access other players' accounts</li>
            <li>Don't try to overload or disrupt the service</li>
          </ul>
        </Section>

        <Section title="5. COMMUNITY BEHAVIOR">
          <p>Be respectful. Offensive, hateful, or harassing content in usernames, display names, or any user-generated content is not tolerated and may result in account suspension.</p>
        </Section>

        <Section title="6. ACCOUNT TERMINATION">
          <p>We reserve the right to suspend or terminate accounts that violate these terms. Specifically:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>Cheating or score manipulation → permanent ban</li>
            <li>Offensive usernames → warning, then suspension</li>
            <li>Abuse of service → immediate suspension</li>
          </ul>
          <p className="mt-2">You can delete your own account at any time through your profile settings.</p>
        </Section>

        <Section title="7. LIABILITY LIMITATIONS">
          <p>Vibing Arkanoid is provided "as is" without warranties. We are not liable for:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>Loss of game progress or data</li>
            <li>Service downtime or interruptions</li>
            <li>Any damages arising from use of the service</li>
          </ul>
        </Section>

        <Section title="8. CHANGES TO TERMS">
          <p>We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.</p>
        </Section>

        <Section title="9. OPEN SOURCE">
          <p>Vibing Arkanoid is open source. The game code is available on GitHub. These terms apply to the hosted service, not the source code itself (which has its own license).</p>
        </Section>

        <div className="flex justify-center gap-3 mt-8">
          <Link to="/" className="px-4 py-2 rounded text-sm font-bold" style={{ background: "hsl(200, 70%, 50%)", color: "white" }}>HOME</Link>
          <Link to="/privacy" className="px-4 py-2 rounded text-sm font-bold" style={{ background: "hsl(0,0%,25%)", color: "hsl(0,0%,80%)", border: "1px solid hsl(0,0%,35%)" }}>PRIVACY</Link>
        </div>
      </div>
    </div>
  </div>
);

export default TermsOfService;
