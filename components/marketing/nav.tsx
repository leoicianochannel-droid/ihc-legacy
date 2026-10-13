import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-foreground/5 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Infinity Hoop home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link href="/#how-it-works" className="text-sm font-medium hover:text-primary">
            How it works
          </Link>
          <Link href="/#what-you-get" className="text-sm font-medium hover:text-primary">
            What you get
          </Link>
          <Link href="/#community" className="text-sm font-medium hover:text-primary">
            Community
          </Link>
          <Link href="/pricing" className="text-sm font-medium hover:text-primary">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <SignedIn>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="gradient" size="sm">
              <Link href="/sign-up">Start 7-day free trial</Link>
            </Button>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
