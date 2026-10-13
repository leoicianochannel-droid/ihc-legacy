import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description: "How we keep the Infinity Hoop community kind, honest, and useful.",
};

export default function GuidelinesPage() {
  return (
    <LegalPage title="Community Guidelines" lastUpdated="May 7, 2026">
      <p>
        Infinity Hoop is a community of women trying to feel good in their
        bodies. The whole point is to be a place where everyone gets what
        you're doing. These guidelines keep it that way.
      </p>
      <p>
        Posting in the community, leaving comments, sending DMs, or
        participating in any social feature on the Platform means you agree
        to follow these guidelines. Breaking them can result in content
        removal, account suspension, or permanent ban — at our discretion,
        with or without notice.
      </p>

      <h2>The vibe we protect</h2>
      <ul>
        <li><strong>Encouragement over comparison.</strong> Celebrate other people's wins.</li>
        <li><strong>Honesty over performance.</strong> Real progress is messy. Share the actual story.</li>
        <li><strong>Questions are welcome.</strong> Nobody is born knowing how to hoop.</li>
        <li><strong>Effort is celebrated, not weight.</strong> The leaderboard ranks workouts and consistency on purpose — not pounds.</li>
      </ul>

      <h2>Not allowed</h2>

      <h3>Disrespect or harm to other members</h3>
      <ul>
        <li>Harassment, threats, hate speech, slurs.</li>
        <li>Body-shaming, fat-phobia, "thinspiration", or weight comparisons aimed at another member.</li>
        <li>Sharing another member's photos, DMs, or private info without their consent.</li>
        <li>Unsolicited DMs of a sexual or romantic nature.</li>
        <li>Impersonating Infinity Hoop staff or another member.</li>
      </ul>

      <h3>Harmful content</h3>
      <ul>
        <li>Pro-eating-disorder content, restrictive-calorie advice, or anything glorifying disordered eating.</li>
        <li>Specific medical advice ("you should stop taking your medication", "this will cure X"). Always recommend speaking with a doctor.</li>
        <li>"Cleanses", detoxes, weight-loss-pills, or supplement promotion.</li>
        <li>Nudity, sexually explicit content, or graphic violence.</li>
      </ul>

      <h3>Commercial / spam</h3>
      <ul>
        <li>Promoting competing fitness products, MLMs, services, or affiliate links.</li>
        <li>Mass-DMing other members.</li>
        <li>Repetitive posts, off-topic posts, or content that's mostly external links.</li>
      </ul>

      <h3>Illegal or platform-abuse</h3>
      <ul>
        <li>Anything illegal in the United States.</li>
        <li>Sharing your account or paying for someone else's access.</li>
        <li>Trying to scrape, copy, or redistribute Infinity Hoop content.</li>
        <li>Trying to break, exploit, or stress-test the Platform.</li>
      </ul>

      <h2>Progress photos — your call</h2>
      <p>
        Progress photos you upload on the <strong>Progress page</strong> are{" "}
        <strong>private</strong> — only you can see them. They aren't shown to
        other members or anyone else.
      </p>
      <p>
        Progress photos you choose to share in a <strong>community post</strong>{" "}
        are visible to other members. That's your choice — share or don't,
        both are welcome.
      </p>

      <h2>Reporting something</h2>
      <p>
        If you see something that violates these guidelines, email{" "}
        <a href="mailto:hello@infinityhoop.com">hello@infinityhoop.com</a>{" "}
        with the subject "Report" and a screenshot or link if you can. We
        review every report — usually within 24 hours.
      </p>
      <p>
        If you're in danger or you see a crisis post, please also contact a
        local emergency service or, in the US, the{" "}
        <strong>988 Suicide & Crisis Lifeline</strong> (call or text 988).
      </p>

      <h2>How we enforce</h2>
      <p>
        Depending on what happened, we may:
      </p>
      <ul>
        <li>Send a warning.</li>
        <li>Remove the offending post, comment, or DM.</li>
        <li>Temporarily suspend posting or messaging.</li>
        <li>Permanently disable the account.</li>
      </ul>
      <p>
        Severe violations (threats, sharing another member's nudes, doxxing)
        result in immediate permanent bans without warning.
      </p>

      <h2>Updates</h2>
      <p>
        We may update these guidelines as the community grows and we learn.
        We'll let you know if we make material changes.
      </p>
    </LegalPage>
  );
}
