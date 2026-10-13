import Link from "next/link";
import { Logo } from "@/components/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-foreground/5 bg-muted/30">
      <div className="container py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo className="h-8" />
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Fun daily movement, real results, and a community of 8,000+ women
              cheering each other on. Built for the women who bought the hoop
              and want to actually see it change things.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider">Platform</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
              <li><Link href="/#what-you-get" className="hover:text-foreground">What you get</Link></li>
              <li><Link href="/#faq" className="hover:text-foreground">FAQ</Link></li>
              <li><Link href="/sign-in" className="hover:text-foreground">Member sign in</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider">Company</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><a href="https://www.infinityhoop.com" className="hover:text-foreground">Shop Infinity Hoop</a></li>
              <li><Link href="/about" className="hover:text-foreground">About</Link></li>
              <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
              <li><Link href="/cookies" className="hover:text-foreground">Cookies</Link></li>
              <li><Link href="/guidelines" className="hover:text-foreground">Community Guidelines</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-foreground/5 pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Infinity Hoop. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
