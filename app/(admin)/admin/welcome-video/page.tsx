import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, AlertCircle } from "lucide-react";
import { getWelcomeVideo } from "@/lib/welcome-video";
import { iframeUrl } from "@/lib/cloudflare-stream";
import { saveWelcomeVideo, removeWelcomeVideo } from "./actions";

export const dynamic = "force-dynamic";

export default async function WelcomeVideoAdminPage() {
  const current = await getWelcomeVideo();

  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Welcome tour video</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A short walkthrough that auto-plays for every new member after they
          finish onboarding. They can skip, but it stays accessible from the
          Welcome / Help page.
        </p>
      </div>

      {/* Current state */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current video</CardTitle>
        </CardHeader>
        <CardContent>
          {current ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Badge>Active</Badge>
                <span className="text-muted-foreground">
                  UID: <code className="rounded bg-muted px-1.5 py-0.5">{current.uid}</code>
                </span>
                {current.durationSec && (
                  <span className="text-muted-foreground">
                    · {Math.ceil(current.durationSec / 60)} min
                  </span>
                )}
              </div>
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
                <iframe
                  src={iframeUrl(current.uid, current.customerCode)}
                  allow="accelerometer; gyroscope; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 size-full"
                />
              </div>
              <form action={removeWelcomeVideo}>
                <Button type="submit" variant="outline" size="sm">
                  Remove video
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertCircle className="size-5 shrink-0" />
              <div>
                <p className="font-semibold">No welcome video configured.</p>
                <p className="mt-0.5">
                  Until you set one, new members go straight to the dashboard
                  after onboarding without a guided tour. Set one below to
                  enable the tour modal.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Set / replace */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {current ? "Replace video" : "Set a video"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Upload your tour video to Cloudflare Stream — either via the{" "}
              <a
                href="https://dash.cloudflare.com/?to=/:account/stream"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Cloudflare Stream dashboard
              </a>{" "}
              or by uploading a workout and copying its UID.
            </li>
            <li>Copy the video's UID (32-character hex) or its playback URL.</li>
            <li>Paste it below — we'll auto-fetch the duration and customer subdomain.</li>
          </ol>

          <form action={saveWelcomeVideo} className="space-y-3">
            <Input
              name="input"
              placeholder="abc123...  or  https://customer-XXX.cloudflarestream.com/abc.../iframe"
              defaultValue={current?.uid ?? ""}
              required
            />
            <Button type="submit" variant="gradient">
              <PlayCircle className="mr-1 size-4" />
              Save welcome video
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* How members see it */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">When it shows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Auto-shown once</strong> after a new member finishes
            onboarding and acknowledges the welcome modal. We track whether
            they watched it (<code>users.demo_video_watched_at</code>) or
            skipped it (<code>users.demo_video_skipped_at</code>) so we never
            interrupt them twice.
          </p>
          <p>
            <strong>Always rewatchable</strong> from <em>Welcome / Help</em>{" "}
            in the member sidebar — a pink "Watch the welcome tour" button
            on that page's hero opens the same player.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
