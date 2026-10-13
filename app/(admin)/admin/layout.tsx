import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { Logo } from "@/components/logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [me] = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!me || me.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-muted/40">
      <AdminSidebar />

      {/* Mobile header — collapses sidebar into a select */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <Logo className="h-6" />
          <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
            ADMIN
          </span>
        </div>
        <AdminMobileNav />
      </header>

      <main className="flex-1 pt-14 md:pt-0">{children}</main>
    </div>
  );
}
