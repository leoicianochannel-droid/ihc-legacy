import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Infinity Hoop collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="May 7, 2026">
      <p>
        Your privacy matters — especially because we collect data that's
        deeply personal: your weight, your photos, your goals. This Privacy
        Policy explains what we collect, why, who we share it with, and the
        rights you have over your information.
      </p>
      <p>
        We are <strong>Infinity Hoop Community LLC</strong>{" "}
        (<strong>"Infinity Hoop"</strong>). This policy applies to the
        Platform — our website, mobile app, and services.
      </p>

      <h2>1. What we collect</h2>

      <h3>Account information you give us</h3>
      <ul>
        <li><strong>Identity:</strong> Name, email, profile photo.</li>
        <li><strong>Authentication:</strong> Managed by our auth provider Clerk — we never see your password.</li>
        <li><strong>Onboarding answers:</strong> Goal, fitness level, age, workout preferences, ideal buddy description, check-in style.</li>
        <li><strong>Subscription info:</strong> Status, plan, billing dates (we never see your full payment card — handled by Skio/Shopify).</li>
      </ul>

      <h3>Sensitive health and fitness data you share with us</h3>
      <p>
        These are <strong>private to you</strong> by default — only you see
        them on your private Progress page.
      </p>
      <ul>
        <li>Weight, waist, hip, chest, thigh, and arm measurements you log.</li>
        <li>Progress photos you upload (stored on Vercel Blob, served only to you).</li>
        <li>Mood and energy levels you rate (1–5 scale).</li>
        <li>Personal notes attached to your check-ins.</li>
      </ul>

      <h3>Activity we record as you use the Platform</h3>
      <ul>
        <li>Workouts you watch and complete.</li>
        <li>Recipes you save.</li>
        <li>Posts, comments, likes, and direct messages.</li>
        <li>Streaks, freeze tokens, tier progression.</li>
        <li>Challenge participation and completion dates.</li>
        <li>Push-notification subscriptions per device.</li>
        <li>Real-time presence (which workout you're playing, while you're playing it — cleared 2 minutes after you stop).</li>
      </ul>

      <h3>Automatic / technical data</h3>
      <ul>
        <li>IP address, browser, device type, timezone.</li>
        <li>Cookies (see our <a href="/cookies">Cookie Policy</a>).</li>
        <li>Server logs of API requests (retained 30 days for security and debugging).</li>
      </ul>

      <h2>2. How we use it</h2>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Data used</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Run the Platform, authenticate you, show your dashboard</td>
            <td>Identity, account, activity</td>
          </tr>
          <tr>
            <td>Process payments and manage your subscription</td>
            <td>Email, subscription info (passed to Skio/Shopify)</td>
          </tr>
          <tr>
            <td>Recommend workouts, send push notifications you've opted into</td>
            <td>Activity, onboarding answers, push subscriptions</td>
          </tr>
          <tr>
            <td>Compute your private progress charts and insights</td>
            <td>Weight, measurements, mood, energy, activity</td>
          </tr>
          <tr>
            <td>Anonymous, aggregated analytics (e.g. "5,231 members hooped this week")</td>
            <td>Activity (de-identified)</td>
          </tr>
          <tr>
            <td>Support requests, fraud prevention, security investigations</td>
            <td>Email, logs, technical data</td>
          </tr>
          <tr>
            <td>Legal compliance and dispute resolution</td>
            <td>Whatever's relevant to the request</td>
          </tr>
        </tbody>
      </table>

      <h2>3. What we share — and what we don't</h2>
      <p>
        We <strong>never sell</strong> your personal data. We share it only in
        the limited cases below:
      </p>
      <ul>
        <li>
          <strong>Service providers</strong> — companies that help us run the
          Platform: Clerk (authentication), Supabase (database hosting), Vercel
          (web hosting + Blob storage), Cloudflare (video streaming), Mux
          (legacy video), Resend (transactional email), Skio + Shopify
          (subscription billing), ElevenLabs / OpenAI (if AI features are
          added). Each only receives the minimum data they need to do their
          job for us.
        </li>
        <li>
          <strong>Other members</strong> — your name, profile photo, tier
          badge, and the public content you post (posts, comments, likes,
          leaderboard placement) are visible to other members. Your private
          data (weight, measurements, photos, mood, energy, notes) is{" "}
          <strong>never</strong> shown to other members.
        </li>
        <li>
          <strong>Legal authorities</strong> — if required by law, subpoena,
          or to protect the rights, safety, or property of Infinity Hoop or
          its members.
        </li>
        <li>
          <strong>In a business transaction</strong> — if Infinity Hoop is
          sold, merged, or acquired, your data may transfer to the new owner.
          We'll notify you in advance.
        </li>
      </ul>

      <h2>4. How long we keep it</h2>
      <ul>
        <li><strong>Account data:</strong> for as long as your account is active, plus 30 days after you delete it.</li>
        <li><strong>Private health data (weight, measurements, photos):</strong> deleted within 30 days of account deletion.</li>
        <li><strong>Public content (posts, comments):</strong> may remain visible after you delete your account unless you also request removal.</li>
        <li><strong>Server logs:</strong> 30 days.</li>
        <li><strong>Subscription / billing records:</strong> 7 years (US tax law).</li>
      </ul>

      <h2>5. Your rights</h2>
      <p>
        Depending on where you live (especially in the EU, UK, California),
        you have rights to:
      </p>
      <ul>
        <li><strong>Access</strong> — get a copy of your data.</li>
        <li><strong>Correct</strong> — fix anything that's wrong.</li>
        <li><strong>Delete</strong> — remove your account and private data.</li>
        <li><strong>Restrict / object</strong> — limit how we use it.</li>
        <li><strong>Portability</strong> — get your data in a portable format.</li>
        <li><strong>Withdraw consent</strong> — for anything you previously opted into (push notifications, marketing email).</li>
      </ul>
      <p>
        To exercise any of these, email{" "}
        <a href="mailto:hello@infinityhoop.com">hello@infinityhoop.com</a>{" "}
        with the subject "Privacy Request". We'll respond within 30 days.
      </p>
      <p>
        California residents: you have additional rights under the CCPA/CPRA.
        We don't sell or share personal information for cross-context
        behavioral advertising.
      </p>

      <h2>6. Children</h2>
      <p>
        The Platform isn't directed at children under 13, and we don't
        knowingly collect data from anyone under 13. If you believe a child
        under 13 has created an account, contact us and we'll remove it.
      </p>

      <h2>7. Security</h2>
      <p>
        We use industry-standard safeguards — encryption in transit (HTTPS),
        encryption at rest (Supabase managed Postgres), tightly-scoped service
        roles, audit logs, and least-privilege access. We can't promise
        perfect security; no online service can. If we ever experience a
        breach affecting your data, we'll notify you within 72 hours of
        discovery.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Infinity Hoop is based in the United States. Your data is stored and
        processed on US-based servers (Supabase, Vercel). If you access the
        Platform from outside the US, your data is transferred to the US.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        If we materially change this policy, we'll notify you by email or
        in-app at least 30 days before the change takes effect.
      </p>

      <h2>10. Contact</h2>
      <p>
        Privacy questions or requests:{" "}
        <a href="mailto:hello@infinityhoop.com">hello@infinityhoop.com</a>
      </p>
    </LegalPage>
  );
}
