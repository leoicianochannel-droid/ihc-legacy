import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The agreement between you and Infinity Hoop Community LLC for use of the platform.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="May 7, 2026">
      <p>
        Welcome to the Infinity Hoop Community. These Terms of Service
        (<strong>"Terms"</strong>) govern your access to and use of the website,
        mobile app, and services (collectively, the <strong>"Platform"</strong>)
        operated by Infinity Hoop Community LLC (<strong>"Infinity Hoop"</strong>,
        <strong>"we"</strong>, <strong>"us"</strong>, or <strong>"our"</strong>).
        By creating an account or using the Platform, you agree to these Terms.
        If you don't agree, please don't use the Platform.
      </p>

      <h2>1. Who can use the Platform</h2>
      <p>
        You must be at least 13 years old to create an account. If you are
        under 18, you must have permission from a parent or legal guardian.
        You agree to provide accurate information, keep your password secure,
        and let us know promptly if you suspect unauthorized account access.
      </p>

      <h2>2. Subscriptions and billing</h2>
      <p>
        Membership is sold as a monthly or annual subscription. Pricing is
        shown on the <a href="/pricing">pricing page</a>. Subscriptions
        auto-renew at the end of each billing period unless cancelled at least
        24 hours before renewal.
      </p>
      <p>
        Billing is processed by our payment partner Skio on Shopify. You can
        cancel, pause, or update payment from your account at any time. Your
        membership remains active through the end of the period you've paid for.
      </p>
      <h3>Free trials and beta access</h3>
      <p>
        If you receive a free trial or beta-tester access, your access expires
        automatically on the end date shown in your account. We'll remind you
        at least seven (7) days before that date so you can decide whether to
        subscribe.
      </p>
      <h3>Refunds</h3>
      <p>
        All subscription fees are non-refundable except where required by law,
        or where we choose to issue a refund at our discretion. If you cancel
        mid-billing-period, you keep access for the rest of that period — no
        partial refund.
      </p>

      <h2>3. The Platform is fitness content — not medical advice</h2>
      <p>
        Infinity Hoop provides general fitness and wellness content, including
        workout videos, recipes, challenges, and community features. We are{" "}
        <strong>
          not medical professionals, licensed dietitians, or healthcare
          providers
        </strong>
        . The content on the Platform is for general informational and
        educational purposes only.
      </p>
      <p>
        Before starting any new exercise or nutrition program — especially if
        you are pregnant, postpartum, recovering from injury, or have any
        medical condition — you should consult with a qualified physician or
        healthcare provider. You participate in any workout, challenge, or
        meal plan <strong>at your own risk</strong>.
      </p>
      <p>
        By using the Platform, you assume full responsibility for any injury,
        illness, or other harm that may result from following any content on
        the Platform. You agree to release Infinity Hoop from any liability
        related to your use of the workouts, recipes, or challenges.
      </p>

      <h2>4. Member content and community</h2>
      <p>
        The Platform lets you post photos, comments, direct messages, progress
        check-ins, and other content (<strong>"Your Content"</strong>). You
        retain ownership of Your Content, but you grant Infinity Hoop a
        worldwide, non-exclusive, royalty-free license to host, display, and
        promote it as part of operating the Platform.
      </p>
      <p>
        You agree to follow our{" "}
        <a href="/guidelines">Community Guidelines</a>. We may remove content
        and suspend or terminate accounts that violate the Guidelines or these
        Terms at our discretion, without notice.
      </p>
      <p>You must not:</p>
      <ul>
        <li>Post nudity, sexual content, hate speech, harassment, or threats.</li>
        <li>Post medical advice, eating-disorder content, or weight-shaming.</li>
        <li>Spam, solicit, or promote competing products or services.</li>
        <li>Share another member's photos, messages, or private info without consent.</li>
        <li>Impersonate Infinity Hoop staff, employees, or other members.</li>
        <li>Use the Platform for any unlawful purpose.</li>
      </ul>

      <h2>5. Intellectual property</h2>
      <p>
        All content provided by Infinity Hoop — workout videos, recipes, the
        Infinity Hoop name and logo, the 45-Day Challenge, downloadable PDFs,
        and the software itself — is owned by Infinity Hoop Community LLC and
        protected by copyright and trademark laws.
      </p>
      <p>
        You may view and use this content solely for your personal,
        non-commercial fitness journey while you have an active subscription.
        You may not copy, redistribute, screenshot to share publicly,
        repurpose, resell, or use the content to train AI/ML models without
        our written permission.
      </p>

      <h2>6. Account suspension and termination</h2>
      <p>
        You can delete your account at any time from your{" "}
        <a href="/settings">settings</a>. We can suspend or terminate your
        account if you violate these Terms, abuse other members, or engage in
        fraudulent payment behavior. On termination:
      </p>
      <ul>
        <li>Your access to the Platform ends immediately.</li>
        <li>Your private content (progress entries, weight, photos) is deleted within 30 days.</li>
        <li>Your public content (posts, comments) may remain visible unless we choose to remove it.</li>
        <li>You remain liable for any outstanding charges.</li>
      </ul>

      <h2>7. Disclaimers and limitation of liability</h2>
      <p>
        The Platform is provided <strong>"as is" and "as available"</strong>.
        We make no warranty that it will be uninterrupted, error-free, secure,
        or fit for a particular purpose.
      </p>
      <p>
        To the maximum extent permitted by law, Infinity Hoop and its
        officers, employees, and affiliates are not liable for any indirect,
        incidental, consequential, special, or punitive damages — including
        but not limited to loss of profit, data, or goodwill — arising from
        your use of the Platform. Our total liability to you for any claim
        arising out of these Terms or the Platform shall not exceed the
        greater of (a) the amount you paid Infinity Hoop in the 12 months
        before the claim arose or (b) USD $100.
      </p>

      <h2>8. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. If we make material
        changes, we will notify you by email or by a notice inside the
        Platform at least 30 days before the change takes effect. Continued
        use after the effective date means you accept the updated Terms.
      </p>

      <h2>9. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the State of [STATE], without
        regard to conflict-of-law principles. Any dispute arising under these
        Terms shall first be addressed through good-faith negotiation. If we
        can't resolve it informally within 60 days, the dispute will be
        submitted to binding arbitration in [COUNTY, STATE] under the rules of
        the American Arbitration Association — except either party may bring
        an individual claim in small claims court.
      </p>
      <p>
        You and Infinity Hoop agree to resolve any disputes on an{" "}
        <strong>individual basis</strong>, and you waive your right to
        participate in a class action or jury trial. (Bracketed items above
        should be filled in by counsel before publishing.)
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href="mailto:hello@infinityhoop.com">hello@infinityhoop.com</a>.
      </p>
    </LegalPage>
  );
}
