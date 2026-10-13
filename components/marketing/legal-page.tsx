import Link from "next/link";
import { AlertCircle } from "lucide-react";

/**
 * Consistent shell for legal pages — Terms / Privacy / Cookies / Guidelines.
 * Adds a top banner noting these are AI-scaffolded drafts that should be
 * reviewed by counsel before relying on them in a dispute. Remove the banner
 * once a lawyer has signed off.
 */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16">
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <AlertCircle className="size-5 shrink-0" />
        <div className="text-xs">
          <p className="font-bold">Draft — review by counsel before launch.</p>
          <p className="mt-0.5">
            This document was generated as a starting point. Have a qualified
            attorney review and adapt it to your jurisdiction before relying on
            it as a binding agreement.
          </p>
        </div>
      </div>

      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
        Infinity Hoop Community
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold md:text-5xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: {lastUpdated}
      </p>

      <div className="legal-prose mt-8 text-foreground">
        {children}
      </div>

      <hr className="my-10 border-muted" />

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/cookies" className="hover:text-foreground">Cookies</Link>
          <Link href="/guidelines" className="hover:text-foreground">Community Guidelines</Link>
        </div>
        <span>Questions? <a href="mailto:hello@infinityhoop.com" className="font-semibold text-primary">hello@infinityhoop.com</a></span>
      </div>
    </div>
  );
}
