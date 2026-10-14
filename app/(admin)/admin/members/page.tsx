import Link from "next/link";
import { db, users, subscriptions, activityLog } from "@/lib/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Search } from "lucide-react";
import { MemberActionButtons } from "./member-action-buttons";
import { AddMemberForm } from "./add-member-form";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const roleFilter = sp.role && ["member", "admin", "coach"].includes(sp.role) ? sp.role : null;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      or(
        ilike(users.email, pattern),
        ilike(users.firstName, pattern),
        ilike(users.lastName, pattern)
      )
    );
  }
  if (roleFilter) conditions.push(eq(users.role, roleFilter as "member" | "admin" | "coach"));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(whereClause);

  const rows = await db
    .select({
      user: users,
      subStatus: subscriptions.status,
      lastActivity: sql<Date | null>`max(${activityLog.createdAt})`,
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .leftJoin(activityLog, eq(activityLog.userId, users.id))
    .where(whereClause)
    .groupBy(users.id, subscriptions.status)
    .orderBy(desc(users.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));

  return (
    <div className="container space-y-6 py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {Number(total).toLocaleString()} total · search by name or email · page {page} of {totalPages}
          </p>
        </div>
      </div>

      <AddMemberForm />

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-center" method="get">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Search by email, first name, or last name…"
                className="pl-10"
              />
            </div>
            <select
              name="role"
              defaultValue={roleFilter ?? ""}
              className="h-11 rounded-xl border bg-background px-4 text-base sm:w-44 md:text-sm"
            >
              <option value="">All roles</option>
              <option value="member">Members</option>
              <option value="admin">Admins</option>
              <option value="coach">Coaches</option>
            </select>
            <Button type="submit" variant="gradient">
              Search
            </Button>
            {(q || roleFilter) && (
              <Button asChild variant="ghost">
                <Link href="/admin/members">Clear</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Member rows */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No members match. Try adjusting the filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const u = row.user;
            const lastActive = row.lastActivity
              ? formatDate(row.lastActivity, { month: "short", day: "numeric", year: undefined })
              : "Never";
            return (
              <Card key={u.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-semibold">
                        {u.firstName ?? "Member"} {u.lastName ?? ""}
                      </span>
                      {u.role === "admin" && <Badge>Admin</Badge>}
                      {u.role === "coach" && <Badge variant="secondary">Coach</Badge>}
                      {u.isBetaTester && (
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          Beta
                        </Badge>
                      )}
                      {row.subStatus && row.subStatus !== "active" && (
                        <Badge variant="outline" className="capitalize">
                          {row.subStatus}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {u.email}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>Joined {formatDate(u.createdAt)}</span>
                      <span>Last active: {lastActive}</span>
                      {u.tier && u.tier !== "starter" && (
                        <span className="capitalize">Tier: {u.tier}</span>
                      )}
                    </div>
                  </div>

                  <MemberActionButtons
                    userId={u.id}
                    isAdmin={u.role === "admin"}
                    isBeta={u.isBetaTester}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button
            asChild
            variant="outline"
            disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-40" : ""}
          >
            <Link href={buildHref({ q, role: roleFilter, page: page - 1 })}>← Prev</Link>
          </Button>
          <span className="text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            asChild
            variant="outline"
            disabled={page >= totalPages}
            className={page >= totalPages ? "pointer-events-none opacity-40" : ""}
          >
            <Link href={buildHref({ q, role: roleFilter, page: page + 1 })}>Next →</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function buildHref(opts: { q?: string; role?: string | null; page: number }) {
  const sp = new URLSearchParams();
  if (opts.q) sp.set("q", opts.q);
  if (opts.role) sp.set("role", opts.role);
  if (opts.page > 1) sp.set("page", String(opts.page));
  const qs = sp.toString();
  return qs ? `/admin/members?${qs}` : "/admin/members";
}
