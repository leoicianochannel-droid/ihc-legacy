"""
Generate the Infinity Hoop welcome-tour video.

Builds a ~90-second branded slideshow from scratch:
  1. For each scene, render a 1920×1080 PNG with PIL using the brand gradient
  2. Generate AI voiceover (macOS `say` with Samantha → AIFF → MP3 via ffmpeg)
  3. Stitch images + audio into a single MP4 with ffmpeg

Output: /Users/ashleybintner/Claude Code/public/welcome-tour.mp4

This script is self-contained — no API keys required. The user can re-run
it after editing the SCENES list to tweak the script or pacing.
"""
import os
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ── Brand palette ───────────────────────────────────────────────────
PRIMARY = (233, 30, 143)       # #E91E8F hot pink
PURPLE = (127, 92, 212)        # #7F5CD4
BG_DARK = (10, 10, 10)
WHITE = (255, 255, 255)
WHITE_DIM = (255, 255, 255, 200)
GOLD = (212, 162, 76)

# ── Layout ───────────────────────────────────────────────────────────
W, H = 1920, 1080
WORK = Path("/tmp/infinity-welcome-tour")
OUT = Path("/Users/ashleybintner/Claude Code/public/welcome-tour.mp4")

# ── Voiceover scenes ────────────────────────────────────────────────
# Each scene has:
#   eyebrow:  small label above the title (UPPERCASE)
#   title:    big display headline
#   body:     supporting line under the title
#   bullets:  optional bulleted list shown on slide
#   narration: what the AI voice will say
SCENES = [
    {
        "eyebrow": "Welcome aboard",
        "title": "You're in.",
        "body": "Let's take a minute so you know exactly where everything lives.",
        "bullets": [],
        "mockup": None,
        # Narration text — keep clean for OpenAI TTS. The `say` pipeline
        # auto-injects SSML pauses on punctuation.
        "narration": "Welcome to the Infinity Hoop community. We're so glad you're here. In the next minute, I'll show you exactly where everything lives. Let's go.",
    },
    {
        "eyebrow": "Today dashboard",
        "title": "Your home base",
        "body": "Open the app — your daily plan is right there.",
        "bullets": [
            "Today's workout, ready to play",
            "Today's recipe with a grocery list",
            "Your current streak and freeze tokens",
        ],
        "mockup": "dashboard",
        "narration": "First up, the Today dashboard. This is your home base. Every time you open the app, you'll see today's workout, today's recipe, and your current streak right at the top. Just tap play and start moving.",
    },
    {
        "eyebrow": "Challenges",
        "title": "Pick your path",
        "body": "Two flagship programs. Start whichever fits where you are.",
        "bullets": [
            "30-Day Challenge for beginners",
            "45-Day Challenge — six weekly progressions",
            "Each new workout unlocks after you finish the last",
        ],
        "mockup": "challenge",
        "narration": "Next, the Challenges section. We have two flagship programs. The 30-Day Challenge is beginner-friendly, with one new video each day. The 45-Day Challenge runs six weekly progressions. Pick whichever feels right for where you are today.",
    },
    {
        "eyebrow": "Community",
        "title": "You're not alone",
        "body": "Post your wins. Ask questions. Lift each other up.",
        "bullets": [
            "Share photos, recipes, transformations",
            "Like and comment right in the feed",
            "Send a direct message to any member",
        ],
        "mockup": "community",
        "narration": "Then, the Community. This is where it all comes alive. Share your wins, ask questions, and lift each other up. You can like and comment on any post, and send a direct message to anyone in the community.",
    },
    {
        "eyebrow": "Progress",
        "title": "Track what matters — privately",
        "body": "Weight, measurements, mood. Only you ever see this.",
        "bullets": [
            "Weight and measurement charts",
            "Activity heatmap, last 90 days",
            "Completely private — only you see it",
        ],
        "mockup": "progress",
        "narration": "Your Progress page is where you track your weight, measurements, and mood over time. And here's the most important part. It's completely private. Only you can see what's there. No one else in the community ever will.",
    },
    {
        "eyebrow": "Rewards & streaks",
        "title": "Show up. Climb tiers.",
        "body": "Daily consistency beats intensity every time.",
        "bullets": [
            "Every 7-day streak earns a freeze token",
            "Miss a day? A freeze automatically saves your streak",
            "Climb tiers: Starter › Mover › Champion › Legend",
        ],
        "mockup": "rewards",
        "narration": "Every time you complete a workout, your streak grows. And every seventh day, you earn a freeze token. If you miss a day, a freeze automatically saves your streak. Just keep showing up. The tiers will follow.",
    },
    {
        "eyebrow": "You're ready",
        "title": "Now go hoop.",
        "body": "Tap Today on the main menu and start your first workout.",
        "bullets": [],
        "mockup": None,
        "narration": "That's it. Tap Today on the main menu, hit play on your first workout, and let's go. We're so excited to have you here. Now go hoop.",
    },
]


# ── Slide rendering ─────────────────────────────────────────────────
def load_font(size: int, bold: bool = False):
    """Find an installed system font for the given weight."""
    candidates = (
        [
            "/System/Library/Fonts/Supplemental/Futura.ttc",
            "/System/Library/Fonts/HelveticaNeue.ttc",
            "/System/Library/Fonts/Helvetica.ttc",
            "/Library/Fonts/Arial.ttf",
        ]
        if bold
        else [
            "/System/Library/Fonts/HelveticaNeue.ttc",
            "/System/Library/Fonts/Helvetica.ttc",
            "/Library/Fonts/Arial.ttf",
        ]
    )
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
    return ImageFont.load_default()


def measure(text: str, font) -> int:
    """Pixel width of `text` rendered in `font`."""
    bbox = font.getbbox(text)
    return bbox[2] - bbox[0]


def fit_text(text: str, *, max_width: int, max_size: int, min_size: int, bold: bool = False):
    """
    Auto-fit `text` into `max_width`:
      1. Try the largest font; if it fits on one line, return it.
      2. Otherwise shrink font size until it fits, OR until min_size.
      3. If still doesn't fit at min_size, word-wrap to 2 lines.

    Returns (font, lines: list[str]).
    """
    size = max_size
    while size >= min_size:
        f = load_font(size, bold=bold)
        if measure(text, f) <= max_width:
            return f, [text]
        size -= 4

    # At min_size, wrap to fit
    f = load_font(min_size, bold=bold)
    words = text.split()
    if not words:
        return f, [text]
    lines: list[str] = []
    current = words[0]
    for w in words[1:]:
        trial = f"{current} {w}"
        if measure(trial, f) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = w
    lines.append(current)
    return f, lines


def gradient_background() -> Image.Image:
    """Diagonal pink → purple gradient as the slide background."""
    img = Image.new("RGB", (W, H), PRIMARY)
    px = img.load()
    for y in range(H):
        for x in range(W):
            t = (x / W * 0.55) + (y / H * 0.45)
            r = int(PRIMARY[0] * (1 - t) + PURPLE[0] * t)
            g = int(PRIMARY[1] * (1 - t) + PURPLE[1] * t)
            b = int(PRIMARY[2] * (1 - t) + PURPLE[2] * t)
            px[x, y] = (r, g, b)
    return img


def draw_infinity_mark(img: Image.Image, cx: int, cy: int, size: int = 280, opacity: int = 40):
    """Subtle ∞ watermark — two overlapping outlined circles."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    radius = size // 2
    offset = int(radius * 0.95)
    stroke = max(8, size // 14)
    color = (255, 255, 255, opacity)
    draw.ellipse(
        (cx - offset - radius, cy - radius, cx - offset + radius, cy + radius),
        outline=color, width=stroke,
    )
    draw.ellipse(
        (cx + offset - radius, cy - radius, cx + offset + radius, cy + radius),
        outline=color, width=stroke,
    )
    img.paste(layer, (0, 0), layer)


# ── Phone-frame UI mockups ─────────────────────────────────────────
# Each mockup renders a rounded "phone screen" portrait rectangle showing
# realistic Infinity Hoop UI content. Used as the right column on content
# slides so viewers see exactly where things live.

PHONE_W = 480
PHONE_H = 980
PHONE_BG = (250, 250, 247)        # warm off-white (matches member-side bg)
INK = (10, 10, 10)
MUTED = (107, 114, 128)
LIGHT_PINK = (252, 228, 241)
SOFT_BG = (243, 244, 246)


def _rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    """Pillow lacks rounded_rectangle on older versions — fall back to manual."""
    if hasattr(draw, "rounded_rectangle"):
        draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)
    else:
        draw.rectangle(xy, fill=fill, outline=outline, width=width)


def render_phone(content_fn) -> Image.Image:
    """Render a phone-shaped portrait image with `content_fn(draw, w, h)`
    drawing the inner screen content. Includes a notch and a thin bezel."""
    img = Image.new("RGBA", (PHONE_W + 40, PHONE_H + 40), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Outer phone body — soft drop shadow first
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    _rounded_rect(sd, (24, 28, 24 + PHONE_W, 28 + PHONE_H), radius=64, fill=(0, 0, 0, 90))
    try:
        from PIL import ImageFilter
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=18))
    except Exception:
        pass
    img.alpha_composite(shadow)

    # Phone body
    _rounded_rect(draw, (20, 20, 20 + PHONE_W, 20 + PHONE_H), radius=62, fill=(20, 20, 20, 255))
    # Screen
    _rounded_rect(draw, (32, 32, 20 + PHONE_W - 12, 20 + PHONE_H - 12), radius=50, fill=PHONE_BG + (255,))
    # Notch
    nx0, ny0, nx1, ny1 = 20 + PHONE_W // 2 - 90, 38, 20 + PHONE_W // 2 + 90, 70
    _rounded_rect(draw, (nx0, ny0, nx1, ny1), radius=16, fill=(20, 20, 20, 255))

    # Inner content drawing — clipped via a temp RGBA layer
    inner = Image.new("RGBA", (PHONE_W - 24, PHONE_H - 24), PHONE_BG + (255,))
    idraw = ImageDraw.Draw(inner)
    content_fn(idraw, inner.width, inner.height)
    img.paste(inner, (32, 80), inner)
    return img


# ── Mockup variants — each draws into a (PHONE_W-24) × (PHONE_H-24) canvas

def mockup_dashboard(d, w, h):
    f_eyebrow = load_font(18, bold=True)
    f_h1 = load_font(36, bold=True)
    f_body = load_font(20)
    f_small = load_font(16)
    f_xs = load_font(14, bold=True)

    # Header
    d.text((24, 24), "TODAY, MAY 18", font=f_eyebrow, fill=MUTED)
    d.text((24, 50), "Hey Ashley 👋", font=f_h1, fill=INK)
    d.text((24, 100), "Here's your plan for today.", font=f_body, fill=MUTED)

    # Live "hooping now" pill
    _rounded_rect(d, (24, 140, 220, 174), radius=17, fill=(254, 226, 226, 255))
    d.ellipse((36, 153, 48, 165), fill=(244, 63, 94, 255))
    d.text((58, 152), "5 hooping now", font=f_xs, fill=(159, 18, 57, 255))

    # Streak card (pink gradient feel)
    sc_top = 200
    _rounded_rect(d, (24, sc_top, w - 24, sc_top + 150), radius=20, fill=LIGHT_PINK + (255,))
    d.text((40, sc_top + 18), "🔥  CURRENT STREAK", font=f_xs, fill=(159, 18, 57, 255))
    d.text((40, sc_top + 46), "47 days", font=load_font(56, bold=True), fill=PRIMARY + (255,))
    d.text((40, sc_top + 110), "Locked in for today ✓", font=f_small, fill=(15, 118, 110, 255))

    # Today's workout card
    tw_top = 380
    _rounded_rect(d, (24, tw_top, w - 24, tw_top + 240), radius=20, fill=(255, 255, 255, 255), outline=(229, 231, 235, 255), width=2)
    # Faux thumbnail (purple gradient block)
    _rounded_rect(d, (40, tw_top + 16, w - 40, tw_top + 156), radius=14, fill=(127, 92, 212, 255))
    # Play triangle
    d.polygon([(w // 2 - 16, tw_top + 76), (w // 2 - 16, tw_top + 116), (w // 2 + 20, tw_top + 96)], fill=(255, 255, 255, 240))
    d.text((40, tw_top + 174), "TODAY'S WORKOUT", font=f_xs, fill=MUTED)
    d.text((40, tw_top + 196), "30-Day · Day 18", font=load_font(22, bold=True), fill=INK)

    # Bottom nav
    nav_top = h - 76
    d.rectangle((0, nav_top, w, h), fill=(255, 255, 255, 255))
    d.line((0, nav_top, w, nav_top), fill=(229, 231, 235, 255), width=1)
    labels = ["Today", "Workouts", "Community", "Progress", "More"]
    col_w = w / len(labels)
    for i, lbl in enumerate(labels):
        cx = int(col_w * i + col_w / 2)
        # Dot for the active item
        if i == 0:
            d.ellipse((cx - 16, nav_top + 10, cx + 16, nav_top + 42), fill=(252, 228, 241, 255))
        col = PRIMARY + (255,) if i == 0 else MUTED + (255,)
        d.text((cx - len(lbl) * 4, nav_top + 50), lbl, font=load_font(11, bold=True), fill=col)


def mockup_challenge(d, w, h):
    f_xs = load_font(14, bold=True)
    f_h1 = load_font(32, bold=True)
    f_body = load_font(18)
    f_small = load_font(15)

    # Hero
    _rounded_rect(d, (24, 28, w - 24, 240), radius=22, fill=(127, 92, 212, 255))
    d.text((40, 50), "30-DAY CHALLENGE", font=f_xs, fill=(255, 255, 255, 230))
    d.text((40, 78), "The Infinity", font=f_h1, fill=(255, 255, 255, 255))
    d.text((40, 116), "30-Day Challenge", font=f_h1, fill=(255, 255, 255, 255))
    d.text((40, 168), "30 videos. 30 days.", font=f_body, fill=(255, 255, 255, 230))
    # Trophy chip
    _rounded_rect(d, (40, 198, 230, 226), radius=14, fill=(255, 255, 255, 60))
    d.text((54, 204), "🏆  6 weeks to go", font=load_font(13, bold=True), fill=(255, 255, 255, 255))

    # Progress section
    d.text((24, 272), "YOUR PROGRESS", font=f_xs, fill=MUTED)
    d.text((24, 296), "Day 7 of 30", font=load_font(28, bold=True), fill=INK)
    # Bar
    _rounded_rect(d, (24, 348, w - 24, 360), radius=6, fill=SOFT_BG + (255,))
    _rounded_rect(d, (24, 348, 24 + int((w - 48) * 0.23), 360), radius=6, fill=PRIMARY + (255,))

    # Day grid (4 cols × 3 rows = 12 shown)
    grid_top = 396
    cell = (w - 48 - 30) / 4
    for r in range(3):
        for c in range(4):
            x0 = 24 + int(c * (cell + 10))
            y0 = grid_top + r * 120
            day = r * 4 + c + 1
            done = day < 8
            locked = day > 8
            border = (229, 231, 235, 255)
            if done:
                _rounded_rect(d, (x0, y0, x0 + int(cell), y0 + 110), radius=14, fill=LIGHT_PINK + (255,), outline=PRIMARY + (255,), width=2)
            else:
                _rounded_rect(d, (x0, y0, x0 + int(cell), y0 + 110), radius=14, fill=(255, 255, 255, 255), outline=border, width=1)
            # Day number
            txt = f"Day {day}"
            col = PRIMARY + (255,) if done else (INK + (255,) if not locked else MUTED + (255,))
            d.text((x0 + 14, y0 + 14), txt, font=load_font(15, bold=True), fill=col)
            if done:
                d.text((x0 + int(cell) - 36, y0 + 14), "✓", font=load_font(20, bold=True), fill=PRIMARY + (255,))
            elif locked:
                d.text((x0 + int(cell) - 28, y0 + 14), "🔒", font=load_font(15), fill=MUTED + (255,))
            # Filler "thumbnail"
            _rounded_rect(d, (x0 + 12, y0 + 50, x0 + int(cell) - 12, y0 + 96), radius=8, fill=(127, 92, 212, 80 if locked else 220))


def mockup_community(d, w, h):
    f_xs = load_font(13, bold=True)
    f_small = load_font(14)
    f_body = load_font(16)
    f_name = load_font(15, bold=True)

    # Header
    d.text((24, 24), "COMMUNITY", font=load_font(13, bold=True), fill=PRIMARY + (255,))
    d.text((24, 46), "Today's wins", font=load_font(28, bold=True), fill=INK)

    # New-post composer
    _rounded_rect(d, (24, 100, w - 24, 156), radius=18, fill=(255, 255, 255, 255), outline=(229, 231, 235, 255), width=1)
    d.ellipse((40, 116, 76, 152), fill=(252, 228, 241, 255))
    d.text((52, 124), "A", font=load_font(18, bold=True), fill=PRIMARY + (255,))
    d.text((92, 122), "Share a win, ask a question…", font=f_small, fill=MUTED)

    # Post 1
    y0 = 184
    _rounded_rect(d, (24, y0, w - 24, y0 + 240), radius=18, fill=(255, 255, 255, 255), outline=(229, 231, 235, 255), width=1)
    d.ellipse((40, y0 + 18, 76, y0 + 54), fill=(184, 212, 232, 255))
    d.text((52, y0 + 26), "S", font=load_font(18, bold=True), fill=(7, 89, 133, 255))
    d.text((92, y0 + 22), "Sarah K.", font=f_name, fill=INK)
    d.text((92, y0 + 42), "today  ·  win", font=f_xs, fill=MUTED)
    d.text(
        (40, y0 + 78),
        "Down 3 inches off my waist —",
        font=f_body, fill=INK,
    )
    d.text(
        (40, y0 + 100),
        "this community keeps me going 💜",
        font=f_body, fill=INK,
    )
    # Interactions
    d.text((40, y0 + 144), "♥  47", font=f_xs, fill=PRIMARY + (255,))
    d.text((112, y0 + 144), "💬  12", font=f_xs, fill=MUTED)
    # Comment preview
    d.line((40, y0 + 174, w - 40, y0 + 174), fill=(229, 231, 235, 255), width=1)
    d.ellipse((40, y0 + 188, 64, y0 + 212), fill=(254, 215, 170, 255))
    _rounded_rect(d, (76, y0 + 186, w - 40, y0 + 222), radius=12, fill=SOFT_BG + (255,))
    d.text((92, y0 + 195), "Maria L.: yes girl!! keep going 🔥", font=f_xs, fill=INK)

    # Post 2 partial
    y2 = y0 + 264
    _rounded_rect(d, (24, y2, w - 24, y2 + 200), radius=18, fill=(255, 255, 255, 255), outline=(229, 231, 235, 255), width=1)
    d.ellipse((40, y2 + 18, 76, y2 + 54), fill=(187, 247, 208, 255))
    d.text((52, y2 + 26), "L", font=load_font(18, bold=True), fill=(22, 101, 52, 255))
    d.text((92, y2 + 22), "Lisa B.", font=f_name, fill=INK)
    d.text((92, y2 + 42), "today  ·  question", font=f_xs, fill=MUTED)
    d.text((40, y2 + 78), "Best time of day to hoop?", font=f_body, fill=INK)
    d.text((40, y2 + 102), "Morning vs. night — anyone", font=f_body, fill=INK)
    d.text((40, y2 + 124), "noticed a difference?", font=f_body, fill=INK)


def mockup_progress(d, w, h):
    f_xs = load_font(13, bold=True)
    f_small = load_font(14)

    # Header
    d.text((24, 24), "🔒  PRIVATE — ONLY YOU SEE THIS", font=f_xs, fill=MUTED)
    d.text((24, 50), "Your progress", font=load_font(28, bold=True), fill=INK)

    # Three stat cards
    stats = [("12.4 lb", "lost"), ("47", "day streak"), ("18", "check-ins")]
    cw = (w - 24 * 2 - 24) / 3
    for i, (val, lbl) in enumerate(stats):
        x0 = 24 + int(i * (cw + 12))
        _rounded_rect(d, (x0, 110, x0 + int(cw), 220), radius=16, fill=(255, 255, 255, 255), outline=(229, 231, 235, 255), width=1)
        d.text((x0 + 12, 124), "📉" if i == 0 else ("🔥" if i == 1 else "🏆"), font=load_font(18), fill=INK)
        d.text((x0 + 12, 150), val, font=load_font(22, bold=True), fill=INK)
        d.text((x0 + 12, 184), lbl, font=load_font(11, bold=True), fill=MUTED)

    # Weight trend chart
    chart_top = 248
    d.text((24, chart_top), "WEIGHT TREND", font=f_xs, fill=PRIMARY + (255,))
    cx0, cy0, cx1, cy1 = 24, chart_top + 30, w - 24, chart_top + 230
    _rounded_rect(d, (cx0, cy0, cx1, cy1), radius=14, fill=(255, 255, 255, 255), outline=(229, 231, 235, 255), width=1)
    # Sparkline (descending squiggle)
    pts = [
        (cx0 + 20, cy0 + 50),
        (cx0 + 60, cy0 + 60),
        (cx0 + 100, cy0 + 56),
        (cx0 + 140, cy0 + 80),
        (cx0 + 180, cy0 + 96),
        (cx0 + 220, cy0 + 88),
        (cx0 + 260, cy0 + 116),
        (cx0 + 300, cy0 + 124),
        (cx0 + 340, cy0 + 144),
        (cx0 + 380, cy0 + 152),
    ]
    pts = [p for p in pts if p[0] < cx1 - 20]
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=PRIMARY + (255,), width=4)
    for p in pts:
        d.ellipse((p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5), fill=PRIMARY + (255,))

    # Heatmap header
    hm_top = 500
    d.text((24, hm_top), "ACTIVITY · LAST 90 DAYS", font=f_xs, fill=PRIMARY + (255,))
    cols = 13
    rows = 7
    size = 22
    gap = 5
    grid_x = 24
    grid_y = hm_top + 30
    for r in range(rows):
        for c in range(cols):
            x = grid_x + c * (size + gap)
            y = grid_y + r * (size + gap)
            # Pseudo-random density — fill some squares pink
            density = ((c * 7 + r * 3) % 9) - 4
            if density <= 0:
                col = (235, 232, 230, 255)
            elif density == 1:
                col = (252, 228, 241, 255)
            elif density == 2:
                col = (244, 114, 182, 255)
            else:
                col = PRIMARY + (255,)
            _rounded_rect(d, (x, y, x + size, y + size), radius=4, fill=col)


def mockup_rewards(d, w, h):
    f_xs = load_font(13, bold=True)
    f_small = load_font(14)

    d.text((24, 24), "REWARDS  &  STREAKS", font=f_xs, fill=PRIMARY + (255,))
    d.text((24, 50), "Showing up matters", font=load_font(26, bold=True), fill=INK)

    # Big streak number + freezes
    _rounded_rect(d, (24, 110, w - 24, 290), radius=22, fill=LIGHT_PINK + (255,))
    d.text((40, 130), "🔥  CURRENT STREAK", font=f_xs, fill=(159, 18, 57, 255))
    d.text((40, 158), "47", font=load_font(80, bold=True), fill=PRIMARY + (255,))
    d.text((178, 200), "days", font=load_font(20), fill=MUTED)
    # Freeze tokens
    d.text((40, 252), "FREEZES", font=f_xs, fill=MUTED)
    for i in range(3):
        cx = 130 + i * 36
        col = (96, 165, 250, 255) if i < 2 else (203, 213, 225, 255)
        d.ellipse((cx - 11, 246, cx + 11, 268), fill=col)
        d.text((cx - 6, 250), "❄", font=load_font(12), fill=(255, 255, 255, 255))

    # Tier ladder
    tiers = [("Starter", "0+", True), ("Mover", "7+", True), ("Champion", "30+", True), ("Legend", "90+", False)]
    ty = 320
    for i, (name, days, achieved) in enumerate(tiers):
        y0 = ty + i * 88
        bg = LIGHT_PINK + (255,) if achieved else (255, 255, 255, 255)
        ring = PRIMARY + (255,) if achieved else (229, 231, 235, 255)
        _rounded_rect(d, (24, y0, w - 24, y0 + 76), radius=16, fill=bg, outline=ring, width=2)
        # Badge dot
        col_badge = PRIMARY + (255,) if achieved else (229, 231, 235, 255)
        d.ellipse((44, y0 + 18, 84, y0 + 58), fill=col_badge)
        emoji = "✨" if i == 0 else ("💫" if i == 1 else ("🔥" if i == 2 else "👑"))
        d.text((52, y0 + 22), emoji, font=load_font(18), fill=(255, 255, 255, 255))
        d.text((104, y0 + 16), name, font=load_font(18, bold=True), fill=INK)
        d.text((104, y0 + 42), f"{days} day streak", font=f_small, fill=MUTED)
        if achieved:
            d.text((w - 60, y0 + 28), "✓", font=load_font(20, bold=True), fill=PRIMARY + (255,))


MOCKUPS = {
    "dashboard": mockup_dashboard,
    "challenge": mockup_challenge,
    "community": mockup_community,
    "progress": mockup_progress,
    "rewards": mockup_rewards,
}


def render_slide(scene: dict, path: Path):
    img = gradient_background()
    # Watermark ∞ behind the text
    draw_infinity_mark(img, W - 360, H - 360, size=480, opacity=28)
    draw_infinity_mark(img, 240, 200, size=280, opacity=18)

    draw = ImageDraw.Draw(img)

    # Eyebrow (small uppercase)
    eyebrow_font = load_font(34, bold=True)
    draw.text(
        (120, 130),
        scene["eyebrow"].upper(),
        font=eyebrow_font,
        fill=(255, 255, 255, 230),
    )

    # When a mockup is specified, reserve the right ~520px for the phone
    # and shrink the text-area accordingly. Otherwise text takes full width.
    mockup_type = scene.get("mockup")
    if mockup_type and mockup_type in MOCKUPS:
        TEXT_MAX_WIDTH = W - 240 - 560  # 120 gutter both sides + 560 for phone
    else:
        TEXT_MAX_WIDTH = W - 240

    # Title — big display, auto-shrink to fit within the safe-zone width so
    # long titles don't run off the right edge of the slide.
    SAFE_MAX_WIDTH = TEXT_MAX_WIDTH
    title_font, title_lines = fit_text(
        scene["title"], max_width=SAFE_MAX_WIDTH, max_size=120 if mockup_type else 140, min_size=68, bold=True
    )
    ty = 200
    for line in title_lines:
        draw.text((120, ty), line, font=title_font, fill=WHITE)
        ty += int(title_font.size * 1.05)

    # Body sub-headline — also gets a soft auto-shrink
    body_font, body_lines = fit_text(
        scene["body"], max_width=SAFE_MAX_WIDTH, max_size=48, min_size=32
    )
    body_y = max(420, ty + 20)
    for line in body_lines:
        draw.text((120, body_y), line, font=body_font, fill=(255, 255, 255, 220))
        body_y += int(body_font.size * 1.15)

    # Bullets — same auto-shrink, but per-line so short bullets still look big
    if scene["bullets"]:
        bullet_size = 44
        y = max(560, body_y + 30)
        for b in scene["bullets"]:
            bf, lines = fit_text(b, max_width=SAFE_MAX_WIDTH - 60, max_size=bullet_size, min_size=28)
            # Pink dot
            draw.ellipse((124, y + 18, 152, y + 46), fill=WHITE)
            for j, line in enumerate(lines):
                draw.text((180, y), line, font=bf, fill=WHITE)
                y += int(bf.size * 1.2) if j < len(lines) - 1 else 0
            y += int(bullet_size * 1.85)

    # Phone mockup (right column)
    if mockup_type and mockup_type in MOCKUPS:
        phone = render_phone(MOCKUPS[mockup_type])
        # Resize to fit vertically in the slide with some breathing room.
        target_h = H - 200
        scale = target_h / phone.height
        new_w = int(phone.width * scale)
        new_h = int(phone.height * scale)
        phone = phone.resize((new_w, new_h), Image.LANCZOS)
        # Position: right gutter 100, vertically centered
        px = W - new_w - 80
        py = (H - new_h) // 2
        # Convert main img to RGBA for proper alpha compositing of the phone
        img_rgba = img.convert("RGBA")
        img_rgba.alpha_composite(phone, (px, py))
        img = img_rgba.convert("RGB")
        draw = ImageDraw.Draw(img)  # rebind for footer below

    # Footer wordmark
    wm_font = load_font(28, bold=True)
    draw.text(
        (120, H - 90),
        "INFINITY HOOP   ·   members.infinityhoop.com",
        font=wm_font,
        fill=(255, 255, 255, 230),
    )

    img.save(path, "PNG", optimize=True)


# ── Audio generation ────────────────────────────────────────────────
def narration_with_pauses(text: str) -> str:
    """Inject macOS [[slnc N]] silence markers after sentence punctuation so
    `say` doesn't blast through the script. ~350ms after periods/?!/—,
    ~150ms after commas. Hugely reduces "robot reading" feel."""
    # Order matters — replace longer punctuation first
    text = text.replace(". ", ". [[slnc 350]]")
    text = text.replace("? ", "? [[slnc 400]]")
    text = text.replace("! ", "! [[slnc 350]]")
    text = text.replace("— ", "— [[slnc 200]]")
    text = text.replace(", ", ", [[slnc 150]]")
    return text


def generate_narration_say(text: str, out_path: Path):
    """macOS `say` fallback — slower rate, Samantha voice, with pause markers."""
    aiff = out_path.with_suffix(".aiff")
    # Rate 162 wpm + pause markers = much more natural cadence than 175 flat
    subprocess.run(
        ["say", "-v", "Samantha", "-r", "162", "-o", str(aiff), narration_with_pauses(text)],
        check=True,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(aiff), "-ar", "44100", "-ac", "2", str(out_path)],
        check=True,
    )
    aiff.unlink()


def generate_narration_openai(text: str, out_path: Path):
    """Use OpenAI's TTS API for dramatically more natural voice. Costs ~1 cent
    for a 90-second video. Uses the 'nova' voice (warm, female, American)
    which suits the brand well. Can be changed via OPENAI_TTS_VOICE env var."""
    import urllib.request
    import json

    voice = os.environ.get("OPENAI_TTS_VOICE", "nova")
    model = os.environ.get("OPENAI_TTS_MODEL", "tts-1-hd")
    body = json.dumps({"model": model, "voice": voice, "input": text}).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=body,
        headers={
            "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
            "Content-Type": "application/json",
        },
    )
    mp3 = out_path.with_suffix(".mp3")
    with urllib.request.urlopen(req) as resp:
        mp3.write_bytes(resp.read())
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-ar", "44100", "-ac", "2", str(out_path)],
        check=True,
    )
    mp3.unlink()


def generate_narration(text: str, out_path: Path):
    """Generate narration audio at out_path (.wav).
    Prefers OpenAI TTS when OPENAI_API_KEY is set, otherwise uses `say`."""
    if os.environ.get("OPENAI_API_KEY"):
        try:
            generate_narration_openai(text, out_path)
            return
        except Exception as err:
            print(f"  ⚠ OpenAI TTS failed ({err}); falling back to `say`")
    generate_narration_say(text, out_path)


def get_duration_sec(audio_path: Path) -> float:
    """ffprobe the wav to figure out how long this scene needs to be on screen."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path),
        ],
        check=True, capture_output=True, text=True,
    )
    return float(result.stdout.strip())


# ── Assembly ─────────────────────────────────────────────────────────
def main():
    WORK.mkdir(parents=True, exist_ok=True)
    print(f"Working dir: {WORK}")

    scene_files: list[tuple[Path, Path, float]] = []  # (image, audio, duration)

    for i, scene in enumerate(SCENES, start=1):
        img_path = WORK / f"scene-{i:02d}.png"
        wav_path = WORK / f"scene-{i:02d}.wav"
        print(f"  scene {i}: rendering image…")
        render_slide(scene, img_path)
        print(f"  scene {i}: generating narration…")
        generate_narration(scene["narration"], wav_path)
        # Add a touch of trailing silence so the cut between scenes doesn't
        # feel rushed. Pad to nearest 0.5s + ~0.7s tail.
        dur = get_duration_sec(wav_path) + 0.7
        scene_files.append((img_path, wav_path, dur))
        print(f"  scene {i}: {dur:.1f}s")

    # Write the ffmpeg concat list — each scene becomes a still image shown
    # for its narration's duration, then we'll overlay the audio on top.
    concat_list = WORK / "concat.txt"
    with open(concat_list, "w") as f:
        for img_path, _wav_path, dur in scene_files:
            f.write(f"file '{img_path}'\n")
            f.write(f"duration {dur}\n")
        # ffmpeg concat demuxer wants the last image listed twice without
        # a final duration to flush it properly.
        f.write(f"file '{scene_files[-1][0]}'\n")

    # Concatenate all narration WAVs into one audio track
    audio_concat = WORK / "audio-concat.txt"
    with open(audio_concat, "w") as f:
        for _img, wav, _dur in scene_files:
            f.write(f"file '{wav}'\n")
    audio_track = WORK / "narration.wav"
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(audio_concat),
            "-c", "copy", str(audio_track),
        ],
        check=True,
    )

    # Build the video from images (no audio yet), then mux audio in.
    # ffmpeg 8 deprecated -vsync; use -fps_mode cfr to force constant frame
    # rate, which is what we want for a slideshow anyway.
    video_only = WORK / "video.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-fps_mode", "cfr",
            "-pix_fmt", "yuv420p",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-r", "30",
            str(video_only),
        ],
        check=True,
    )

    # Pad audio with a half second of silence at the start so the first
    # frame has time to register before voice begins.
    audio_padded = WORK / "narration-padded.wav"
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(audio_track),
            "-af", "adelay=400|400",
            str(audio_padded),
        ],
        check=True,
    )

    # Final mux
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(video_only),
            "-i", str(audio_padded),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            str(OUT),
        ],
        check=True,
    )

    print(f"\n✅ Welcome video created: {OUT}")
    total = sum(d for _, _, d in scene_files)
    print(f"   Length: {total:.1f}s")
    print(f"\nNext: upload to Cloudflare Stream and set the welcome video UID.")


if __name__ == "__main__":
    main()
