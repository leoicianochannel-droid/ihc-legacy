import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="absolute inset-0 hoop-gradient opacity-50" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/60 to-background" aria-hidden />

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo className="h-10" />
        </Link>
        <div className="rounded-3xl border bg-card shadow-xl overflow-hidden">{children}</div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/legal/terms" className="underline">Terms</Link> and{" "}
          <Link href="/legal/privacy" className="underline">Privacy</Link>.
        </p>
      </div>
    </div>
  );
}
