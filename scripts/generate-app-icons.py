"""
Generates PWA / home-screen icons for the Infinity Hoop community app.

Produces:
  public/icon-192.png         (Android primary, 192x192)
  public/icon-512.png         (Android splash + store, 512x512)
  public/icon-maskable.png    (Android adaptive icon with safe zone, 512x512)
  public/apple-touch-icon.png (iOS home screen, 180x180)
  public/favicon.png          (favicon, 32x32)

Design: matches the official brand mark — the ∞ logo, rendered as two
overlapping stroked circles. We keep a brand-pink gradient background so
the home-screen icon is visually distinct from a system app icon.
"""
from PIL import Image, ImageDraw

PRIMARY = (233, 30, 143)     # #E91E8F
PURPLE = (127, 92, 212)      # #7F5CD4
WHITE = (255, 255, 255)

OUT_DIR = "/Users/ashleybintner/Claude Code/public"


def gradient_square(size: int) -> Image.Image:
    """Diagonal pink→purple gradient square — brand-pink home screen tile."""
    img = Image.new("RGB", (size, size), PRIMARY)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            r = int(PRIMARY[0] * (1 - t) + PURPLE[0] * t)
            g = int(PRIMARY[1] * (1 - t) + PURPLE[1] * t)
            b = int(PRIMARY[2] * (1 - t) + PURPLE[2] * t)
            px[x, y] = (r, g, b)
    return img


def draw_brand_infinity(img: Image.Image, scale: float = 1.0) -> Image.Image:
    """Draw the brand ∞ — two overlapping stroked circles, white-on-gradient."""
    size = img.width
    draw = ImageDraw.Draw(img)

    # Two overlapping circles, sized to fill ~70% of the icon at scale=1
    radius = int(size * 0.20 * scale)
    offset_x = int(size * 0.15 * scale)
    cx = size / 2
    cy = size / 2
    stroke = max(4, int(size * 0.07 * scale))

    def circle(center_x: float, center_y: float, r: float):
        box = (
            int(center_x - r),
            int(center_y - r),
            int(center_x + r),
            int(center_y + r),
        )
        draw.ellipse(box, outline=WHITE, width=stroke)

    circle(cx - offset_x, cy, radius)
    circle(cx + offset_x, cy, radius)
    return img


def make_icon(size: int, *, mask_safe_pad: float = 0.0) -> Image.Image:
    """Build a square icon. mask_safe_pad shrinks the artwork into a centered
    safe zone (used for `maskable` Android icons that get circle-cropped)."""
    base = gradient_square(size)
    scale = 1.0 - mask_safe_pad
    return draw_brand_infinity(base, scale=scale)


def save(img: Image.Image, path: str):
    img.save(path, "PNG", optimize=True)
    print(f"✓ {path} ({img.width}x{img.height})")


if __name__ == "__main__":
    save(make_icon(192), f"{OUT_DIR}/icon-192.png")
    save(make_icon(512), f"{OUT_DIR}/icon-512.png")
    # Maskable: shrink artwork into the center 60% (Android may crop to circle)
    save(make_icon(512, mask_safe_pad=0.30), f"{OUT_DIR}/icon-maskable.png")
    save(make_icon(180), f"{OUT_DIR}/apple-touch-icon.png")
    save(make_icon(32), f"{OUT_DIR}/favicon.png")
