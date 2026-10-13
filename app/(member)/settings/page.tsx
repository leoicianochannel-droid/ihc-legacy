import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, users, subscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { manageSubscriptionUrl, buildCheckoutUrl } from "@/lib/skio";
import { getAppUrl } from "@/lib/app-url";
import { ThemeToggle } from "@/components/theme-toggle";
import { AlertCircle } from "lucide-react";
import { NotificationsToggle } from "@/components/pwa/notifications-toggle";
import { ReminderTimePicker } from "@/components/pwa/reminder-time-picker";
import { TimezoneSelector } from "./timezone-selector";
import { AvatarUploader } from "@/components/member/avatar-uploader";

export default async function SettingsPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const [me] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me) redirect("/onboarding");

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, me.id)).limit(1);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-10 md:py-8">
      <h1 className="font-display text-4xl font-bold">Settings</h1>

      {(!me.avatarUrl || !me.goal) && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Your profile is incomplete</p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-400">
              {!me.avatarUrl && !me.goal
                ? "Add a profile photo and set your fitness goal to get the most from the community."
                : !me.avatarUrl
                ? "Add a profile photo so your buddy and community know who you are."
                : "Set your fitness goal so we can tailor your experience."}
            </p>
          </div>
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-5">
          <AvatarUploader
            currentUrl={me.avatarUrl}
            name={`${me.firstName ?? ""} ${me.lastName ?? ""}`.trim()}
            size="lg"
          />
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Tap your photo to change it</p>
            <p className="mt-0.5">Visible to your accountability buddy and in the community feed.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="font-semibold">Name:</span> {me.firstName} {me.lastName}</div>
          <div><span className="font-semibold">Email:</span> {me.email}</div>
          {me.isBetaTester && me.freeAccessUntil && (
            <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
              <span className="font-bold text-primary">✨ Beta Tester</span>
              <p className="mt-0.5 text-muted-foreground">
                You have free access through{" "}
                <strong>{formatDate(me.freeAccessUntil)}</strong>. After that you'll need
                to subscribe to keep your access — we'll remind you a week before. Your
                feedback shapes what we build, so thank you 💜
              </p>
            </div>
          )}
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/user-profile">Manage account →</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Membership</CardTitle>
          {sub && (
            <Badge variant={sub.status === "active" || sub.status === "trialing" ? "default" : "outline"} className="capitalize">
              {sub.status}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {sub ? (
            <>
              <div><span className="font-semibold">Plan:</span> Infinity Hoop Membership ($39.99/mo)</div>
              {sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date() && (
                <div className="text-primary font-semibold">
                  🎉 Free trial through {formatDate(sub.trialEndsAt)}
                </div>
              )}
              {sub.currentPeriodEnd && (
                <div><span className="font-semibold">Next billing:</span> {formatDate(sub.currentPeriodEnd)}</div>
              )}
              <p className="text-xs text-muted-foreground">
                Subscription billing is handled by Shopify. Manage payment, skip,
                pause, or cancel from your Infinity Hoop account.
              </p>
              <Button asChild variant="outline" size="sm">
                <a href="https://www.infinityhoop.com/a/account/subscriptions" target="_blank" rel="noopener noreferrer">
                  Manage my subscription →
                </a>
              </Button>
            </>
          ) : (
            <>
              <div className="text-muted-foreground">
                No active membership. If you've been a Skool community member, your subscription
                may need a moment to sync — try refreshing in a minute.
              </div>
              <Button asChild variant="gradient" size="sm">
                <a href={buildCheckoutUrl({ email: me.email, returnUrl: getAppUrl() })}>
                  Start 30-day free trial
                </a>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <NotificationsToggle />
          <ReminderTimePicker initialTime={me.reminderTime} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Timezone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Used for streak resets, reminders, and scheduling.
          </p>
          <TimezoneSelector current={me.timezone ?? "America/New_York"} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Choose how the app looks. System follows your device setting.
          </p>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Your onboarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="font-semibold">Goal:</span> {me.goal ?? "—"}</div>
          <div><span className="font-semibold">Fitness level:</span> {me.fitnessLevel ?? "—"}</div>
          <div><span className="font-semibold">Ideal buddy:</span> {me.idealBuddyWords ?? "—"}</div>
          <div><span className="font-semibold">Check-in style:</span> {me.checkInStyle ?? "—"}</div>
        </CardContent>
      </Card>
    </div>
  );
}
