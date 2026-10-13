import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { and, eq, ilike, not, isNull, or } from "drizzle-orm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Search } from "lucide-react";
import { MemberSearch } from "./member-search";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const [me] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!me) redirect("/onboarding");

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const filter = and(
    not(eq(users.id, me.id)),
    not(isNull(users.onboardedAt)),
    query
      ? or(
          ilike(users.firstName, `%${query}%`),
          ilike(users.lastName, `%${query}%`)
        )
      : undefined
  );

  const members = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      fitnessLevel: users.fitnessLevel,
      role: users.role,
      migratedFromSkool: users.migratedFromSkool,
    })
    .from(users)
    .where(filter)
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-10 md:py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Members</h1>
        <p className="mt-1 text-muted-foreground">Find and message anyone in the community.</p>
      </div>

      <MemberSearch defaultValue={query} />

      {members.length === 0 ? (
        <div className="mt-12 text-center text-muted-foreground">
          {query ? `No members found for "${query}"` : "No members yet."}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {members.map((m) => {
            const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || "Member";
            const initials = [m.firstName, m.lastName]
              .filter(Boolean)
              .map((n) => n![0])
              .join("")
              .toUpperCase() || "?";
            return (
              <div
                key={m.id}
                className="relative flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                {/* Full-card profile link — sits behind the Message button */}
                <Link
                  href={`/profile/${m.id}`}
                  className="absolute inset-0 rounded-xl"
                  aria-label={`View ${name}'s profile`}
                />
                <Avatar className="size-12 shrink-0">
                  <AvatarImage src={m.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-primary/10 font-display font-bold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">{name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {m.fitnessLevel && (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {m.fitnessLevel}
                      </Badge>
                    )}
                    {m.migratedFromSkool && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                        ⭐ Founding
                      </Badge>
                    )}
                    {m.role !== "member" && (
                      <Badge className="text-[10px] capitalize bg-primary/10 text-primary hover:bg-primary/10 border-none">
                        {m.role}
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Message button is positioned above the card link */}
                <Button asChild variant="outline" className="relative z-10 h-9 shrink-0 px-3 text-xs">
                  <Link href={`/messages/start?userId=${m.id}`}>
                    <MessageCircle className="mr-1.5 size-3.5" />
                    Message
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {members.length === 100 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Showing first 100 results — use search to narrow down.
        </p>
      )}
    </div>
  );
}
