import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "What cookies we use on the Infinity Hoop Platform and why.",
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="May 7, 2026">
      <p>
        This Cookie Policy explains the small files we store on your device
        when you use the Infinity Hoop Platform — what they do, how long
        they last, and how to control them. For the wider context, see our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>What's a cookie?</h2>
      <p>
        A cookie is a tiny piece of data stored by your browser. We also use
        similar technologies (<strong>localStorage</strong>,{" "}
        <strong>service workers</strong>) — collectively referred to as
        "cookies" in this policy.
      </p>

      <h2>What we use, and why</h2>

      <h3>Strictly necessary (always on)</h3>
      <p>
        These keep you logged in and the Platform working. We can't turn them
        off because the site wouldn't function without them.
      </p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>__session, __client (Clerk)</td>
            <td>Authentication — keeps you signed in</td>
            <td>Session / 1 year</td>
          </tr>
          <tr>
            <td>ih_admin_invite</td>
            <td>Carries an admin invite token through sign-up</td>
            <td>2 hours</td>
          </tr>
          <tr>
            <td>Service worker cache</td>
            <td>Offline page support, faster repeat loads</td>
            <td>Until cache version bumps</td>
          </tr>
        </tbody>
      </table>

      <h3>Functional (always on — saved as a preference)</h3>
      <p>
        These remember small choices you've made so the Platform feels less
        repetitive.
      </p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>theme</td>
            <td>Your light / dark / system theme choice</td>
            <td>Forever (until you clear it)</td>
          </tr>
          <tr>
            <td>ih_install_dismissed</td>
            <td>Hides the "install our app" prompt after you dismiss it</td>
            <td>14 days</td>
          </tr>
          <tr>
            <td>ih_cookie_consent</td>
            <td>Remembers your cookie banner choice</td>
            <td>1 year</td>
          </tr>
        </tbody>
      </table>

      <h3>Analytics (off until you opt in)</h3>
      <p>
        We don't currently run any third-party analytics. If we add them in
        the future, they will be off by default and you can opt in via the
        cookie banner. We will update this policy when that changes.
      </p>

      <h3>Advertising</h3>
      <p>
        We don't use advertising cookies. We don't sell your data and don't
        run ads on the Platform.
      </p>

      <h2>How to control cookies</h2>
      <ul>
        <li>
          <strong>The cookie banner.</strong> On your first visit, the banner
          at the bottom of the screen lets you accept or reject non-essential
          cookies. You can change your mind any time by clicking "Cookie
          settings" in the footer.
        </li>
        <li>
          <strong>Your browser.</strong> All modern browsers let you block or
          delete cookies for specific sites. Note that blocking essential
          cookies will sign you out and may break parts of the Platform.
        </li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions:{" "}
        <a href="mailto:hello@infinityhoop.com">hello@infinityhoop.com</a>
      </p>
    </LegalPage>
  );
}
