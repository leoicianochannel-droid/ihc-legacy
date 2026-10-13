import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const day = Math.max(1, parseInt(searchParams.get("day") ?? "1", 10));
  const total = Math.max(1, parseInt(searchParams.get("total") ?? "30", 10));

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(145deg, #130820 0%, #2d1240 45%, #130820 100%)",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Background glow blobs */}
        <div
          style={{
            position: "absolute",
            top: "-80px",
            left: "-80px",
            width: "480px",
            height: "480px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(209,3,82,0.25) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-120px",
            right: "-80px",
            width: "540px",
            height: "540px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(140,0,200,0.2) 0%, transparent 70%)",
          }}
        />

        {/* Top badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(209,3,82,0.18)",
            border: "1px solid rgba(209,3,82,0.45)",
            borderRadius: "100px",
            padding: "10px 28px",
            marginBottom: "48px",
          }}
        >
          <span style={{ fontSize: "20px", color: "#f472b6", letterSpacing: "0.15em", fontWeight: 600 }}>
            30-DAY CHALLENGE
          </span>
        </div>

        {/* Day number */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <span
            style={{
              fontSize: "48px",
              color: "rgba(255,255,255,0.55)",
              letterSpacing: "0.1em",
              fontWeight: 500,
              lineHeight: 1,
              marginBottom: "4px",
            }}
          >
            DAY
          </span>
          <span
            style={{
              fontSize: "220px",
              fontWeight: 800,
              lineHeight: 0.88,
              background: "linear-gradient(135deg, #ffffff 0%, #f9a8d4 60%, #d10352 100%)",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            {day}
          </span>
        </div>

        {/* Checkmark + "COMPLETE" */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginTop: "16px",
            marginBottom: "64px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #d10352, #9d0099)",
            }}
          >
            {/* SVG checkmark path — avoids Satori dynamic font lookups */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "48px",
              fontWeight: 700,
              color: "white",
              letterSpacing: "0.12em",
            }}
          >
            COMPLETE
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
            marginBottom: "64px",
            width: "520px",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "8px",
              borderRadius: "100px",
              background: "rgba(255,255,255,0.12)",
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round((day / total) * 100)}%`,
                background: "linear-gradient(90deg, #d10352, #9d0099)",
                borderRadius: "100px",
              }}
            />
          </div>
          <span style={{ fontSize: "22px", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
            {day} of {total} days
          </span>
        </div>

        {/* Hashtag */}
        <span
          style={{
            fontSize: "30px",
            color: "rgba(244,114,182,0.75)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            marginBottom: "32px",
          }}
        >
          #InfinityHoop
        </span>

        {/* Brand footer */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "26px", color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.05em" }}>
            infinityhoop.com
          </span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
    }
  );
}
