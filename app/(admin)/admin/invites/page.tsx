import { db, adminInvites, users } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { getAppUrl } from "@/lib/app-url";
import { formatDate } from "@/lib/utils";
import { createAdminInvite, revokeAdminInvite } from "./actions";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";

export default async function AdminInvitesPage() {
  const rows = await db
    .select({
      invite: adminInvites,
      creator: users,
    })
    .from(adminInvites)
    .leftJoin(users, eq(users.id, adminInvites.createdById))
    .orderBy(desc(adminInvites.createdAt));

  const baseUrl = getAppUrl();

  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" />
          <h1 className="font-display text-3xl font-bold">Admin invite links</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Share a link below with someone you trust — when they sign up via that
          link, they'll become an admin automatically. Revoke any link instantly
          if you change your mind.
        </p>
      </div>

      {/* Create new */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-display text-lg font-bold">Create a new invite</h2>
          <form action={createAdminInvite} className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Label (optional)
              </label>
              <Input
                name="label"
                placeholder='e.g. "Chris — cofounder", "Coach team"'
                maxLength={200}
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Max uses
              </label>
              <select
                name="maxUses"
                defaultValue="1"
                className="mt-1 h-11 w-full rounded-xl border bg-background px-4 text-base md:text-sm"
              >
                <option value="1">1 person (single use)</option>
                <option value="3">3 people</option>
                <option value="10">10 people</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Expires
              </label>
              <select
                name="expiresInDays"
                defaultValue="14"
                className="mt-1 h-11 w-full rounded-xl border bg-background px-4 text-base md:text-sm"
              >
                <option value="1">In 1 day</option>
                <option value="7">In 7 days</option>
                <option value="14">In 14 days</option>
                <option value="30">In 30 days</option>
                <option value="never">Never</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button type="submit" variant="gradient" className="w-full">
                Create invite link
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">
          Existing invites ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No invites yet. Create one above to share with your team.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map(({ invite, creator }) => {
              const url = `${baseUrl}/admin-join/${invite.token}`;
              const expired =
                invite.expiresAt && new Date(invite.expiresAt) < new Date();
              const exhausted =
                invite.maxUses != null && invite.usedCount >= invite.maxUses;
              const dead = invite.revokedAt || expired || exhausted;
              return (
                <Card
                  key={invite.id}
                  className={dead ? "opacity-60" : undefined}
                >
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {invite.label ?? "Untitled invite"}
                      </span>
                      {invite.revokedAt && (
                        <Badge variant="outline" className="text-[10px]">
                          Revoked
                        </Badge>
                      )}
                      {!invite.revokedAt && expired && (
                        <Badge variant="outline" className="text-[10px]">
                          Expired
                        </Badge>
                      )}
                      {!invite.revokedAt && !expired && exhausted && (
                        <Badge variant="outline" className="text-[10px]">
                          Used up
                        </Badge>
                      )}
                      {!dead && (
                        <Badge className="text-[10px]">
                          Active
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">
                        {url}
                      </code>
                      <CopyButton value={url} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Used {invite.usedCount}
                        {invite.maxUses != null ? ` / ${invite.maxUses}` : ""}
                      </span>
                      <span>
                        Expires:{" "}
                        {invite.expiresAt
                          ? formatDate(invite.expiresAt)
                          : "Never"}
                      </span>
                      <span>
                        Created by{" "}
                        {creator?.firstName ?? "—"}{" "}
                        {(creator?.lastName ?? "").slice(0, 1)}
                        {creator?.lastName ? "." : ""}{" "}
                        on {formatDate(invite.createdAt)}
                      </span>
                      {!dead && (
                        <form
                          action={revokeAdminInvite.bind(null, invite.id)}
                          className="ml-auto"
                        >
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                          >
                            Revoke
                          </Button>
                        </form>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
