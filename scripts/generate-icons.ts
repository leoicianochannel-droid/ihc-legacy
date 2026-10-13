import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import sharp from "sharp";
import * as path from "path";
import * as fs from "fs";

// SVG infinity symbol — white on black, matching the provided logo
function makeIconSvg(size: number, padding: number): string {
  const inner = size - padding * 2;
  // The infinity shape is drawn as two overlapping circles (lemniscate approximation)
  // using bezier curves — this matches the clean bold style in the reference image.
  const cx = size / 2;
  const cy = size / 2;
  // Scale the path to fit within `inner` × (inner * 0.5) centered in the square
  const w = inner * 0.88;
  const h = w * 0.46;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const ymid = cy;
  const ctrl = w * 0.23;
  const stroke = inner * 0.115;

  // Path: a figure-eight / lemniscate using two mirrored cubic beziers
  // Starts at the left crossing point, draws the left lobe, crosses back, draws right lobe
  const d = [
    `M ${cx} ${ymid}`,
    // left lobe — up and left
    `C ${cx - ctrl} ${y0}, ${x0} ${y0}, ${x0} ${ymid}`,
    `C ${x0} ${y1}, ${cx - ctrl} ${y1}, ${cx} ${ymid}`,
    // right lobe — up and right
    `C ${cx + ctrl} ${y0}, ${x1} ${y0}, ${x1} ${ymid}`,
    `C ${x1} ${y1}, ${cx + ctrl} ${y1}, ${cx} ${ymid}`,
    "Z",
  ].join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#000000"/>
  <path d="${d}" fill="none" stroke="white" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

async function generateIcon(size: number, padding: number, outputPath: string) {
  const svg = makeIconSvg(size, padding);
  const buf = Buffer.from(svg);
  await sharp(buf).resize(size, size).png().toFile(outputPath);
  console.log(`✅ ${path.basename(outputPath)} (${size}×${size})`);
}

async function main() {
  const publicDir = path.resolve("public");

  // Standard app icon — no padding
  await generateIcon(192, 24, path.join(publicDir, "icon-192.png"));
  await generateIcon(512, 60, path.join(publicDir, "icon-512.png"));

  // Apple touch icon (180×180)
  await generateIcon(180, 20, path.join(publicDir, "apple-touch-icon.png"));

  // Maskable icon — needs safe zone: at least 10% on all sides (so ~20% total padding)
  // We give it ~20% padding so the symbol is safe inside the iOS/Android mask circle
  await generateIcon(512, 90, path.join(publicDir, "icon-maskable.png"));

  // Favicon (32×32 and 16×16 — save as PNG, Next.js serves it as favicon.png)
  await generateIcon(32, 3, path.join(publicDir, "favicon.png"));

  console.log("\n✨ All icons generated.");
}

main().catch((e) => { console.error(e); process.exit(1); });
