/**
 * Generates a branded cover image for each workout.
 *
 * Priority:
 *   1. Custom thumbnailUrl stored on the workout row
 *   2. Cloudflare Stream auto-generated frame (if video exists)
 *   3. Premium gradient card with workout metadata (no photo needed)
 *
 * 16:9 (1280×720), aggressively cached.
 */
import { ImageResponse } from "next/og";
import { db, workouts } from "@/lib/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// Category → gradient stop colors (all using brand-adjacent tones)
const INTENSITY_GRADIENTS: Record<string, [string, string]> = {
  beginner:     ["#d10352", "#ff6b9e"],
  intermediate: ["#b8024a", "#e8185e"],
  advanced:     ["#8c0038", "#d10352"],
  all:          ["#d10352", "#ff4d8b"],
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const [w] = await db.select().from(workouts).where(eq(workouts.slug, slug)).limit(1);

  if (!w) {
    return new Response("Not found", { status: 404 });
  }

  // Prefer custom thumbnail, fall back to Cloudflare auto-generated frame
  const thumb =
    w.thumbnailUrl
      ? (w.thumbnailUrl.startsWith("http") ? w.thumbnailUrl : `https://ihcommunity.com${w.thumbnailUrl}`)
      : w.cfStreamUid && w.cfCustomerCode
        ? `https://customer-${w.cfCustomerCode}.cloudflarestream.com/${w.cfStreamUid}/thumbnails/thumbnail.jpg?time=5s&width=1280&height=720&fit=crop`
        : null;

  const [gradFrom, gradTo] = INTENSITY_GRADIENTS[w.intensity?.toLowerCase() ?? "all"] ?? ["#d10352", "#ff4d8b"];

  return new ImageResponse(
    thumb ? (
      // ── Photo / video frame version ──────────────────────────────────────
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#111",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* Gradient overlay bottom */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.88) 100%)",
            display: "flex",
          }}
        />
        {/* Brand pill top-left */}
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 40,
            background: "#d10352",
            color: "#fff",
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 3,
            padding: "8px 20px",
            borderRadius: 999,
            display: "flex",
          }}
        >
          INFINITY HOOP
        </div>
        {/* Title + badges bottom */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "32px 50px",
            display: "flex",
            flexDirection: "column",
            color: "white",
          }}
        >
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {w.durationMin && (
              <span
                style={{
                  background: "rgba(0,0,0,0.55)",
                  color: "white",
                  padding: "6px 16px",
                  borderRadius: 999,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 1,
                  display: "flex",
                }}
              >
                {w.durationMin} MIN
              </span>
            )}
            {w.intensity && (
              <span
                style={{
                  background: "#d10352",
                  color: "white",
                  padding: "6px 16px",
                  borderRadius: 999,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  display: "flex",
                }}
              >
                {w.intensity}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 1.05,
              textShadow: "0 2px 20px rgba(0,0,0,0.5)",
            }}
          >
            {w.title}
          </div>
        </div>
      </div>
    ) : (
      // ── Premium gradient card (no photo) ─────────────────────────────────
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: `linear-gradient(135deg, ${gradFrom} 0%, ${gradTo} 60%, #ff9ec4 100%)`,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Geometric accent circles */}
        <div
          style={{
            position: "absolute",
            right: -80,
            top: -80,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 60,
            top: 60,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -60,
            bottom: -60,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.08)",
            display: "flex",
          }}
        />

        {/* Brand wordmark */}
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 52,
            color: "rgba(255,255,255,0.9)",
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: 5,
            display: "flex",
          }}
        >
          INFINITY HOOP
        </div>

        {/* Main content */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "0 52px 52px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Badges */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {w.durationMin && (
              <span
                style={{
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  padding: "8px 20px",
                  borderRadius: 999,
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: 1,
                  display: "flex",
                  backdropFilter: "blur(10px)",
                }}
              >
                {w.durationMin} MIN
              </span>
            )}
            {w.intensity && (
              <span
                style={{
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  padding: "8px 20px",
                  borderRadius: 999,
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  display: "flex",
                  backdropFilter: "blur(10px)",
                }}
              >
                {w.intensity}
              </span>
            )}
          </div>

          {/* Workout title */}
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: "white",
              lineHeight: 1.0,
              letterSpacing: -1,
              textShadow: "0 4px 24px rgba(0,0,0,0.2)",
            }}
          >
            {w.title}
          </div>

          {/* Instructor */}
          {w.instructor && (
            <div
              style={{
                fontSize: 24,
                color: "rgba(255,255,255,0.75)",
                fontWeight: 500,
                marginTop: 12,
                display: "flex",
              }}
            >
              with {w.instructor}
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1280,
      height: 720,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    }
  );
}
