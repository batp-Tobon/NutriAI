// Genera los PNG de la PWA a partir de public/icons/icon.svg
// Uso: npm run icons   (requiere la devDependency "sharp")
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
const svg = readFileSync(join(iconsDir, "icon.svg"));

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "maskable-512.png", size: 512, pad: 0.12 },
];

for (const t of targets) {
  let img = sharp(svg).resize(t.size, t.size);
  if (t.pad) {
    const inner = Math.round(t.size * (1 - t.pad * 2));
    img = sharp(svg)
      .resize(inner, inner)
      .extend({
        top: Math.round((t.size - inner) / 2),
        bottom: Math.round((t.size - inner) / 2),
        left: Math.round((t.size - inner) / 2),
        right: Math.round((t.size - inner) / 2),
        background: "#0a0a0a",
      });
  }
  await img.png().toFile(join(iconsDir, t.name));
  console.log("✓", t.name);
}
