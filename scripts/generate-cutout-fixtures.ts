import sharp from "sharp";

import { getAllEntries } from "../src/lib/content";
import { processCutout } from "../src/lib/cutout/process";
import { PassthroughProvider } from "../src/lib/cutout/remove-bg";

const PALETTES = [
  { fill: "#5c4033", grain: "#d9c3a8" },
  { fill: "#1f3b4d", grain: "#9eb6c4" },
  { fill: "#3d2a44", grain: "#c9b4c6" },
  { fill: "#4a3b1f", grain: "#e0d1a8" },
  { fill: "#2c3a2c", grain: "#b7c4b0" },
  { fill: "#5a2a2a", grain: "#e2b8b8" }
];

async function makeSilhouette(seed: number, width: number, height: number, palette: (typeof PALETTES)[number]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="none"/>
    <ellipse cx="${width / 2}" cy="${height * 0.28}" rx="${width * 0.22}" ry="${height * 0.18}" fill="${palette.fill}"/>
    <ellipse cx="${width / 2}" cy="${height * 0.72}" rx="${width * 0.34}" ry="${height * 0.32}" fill="${palette.fill}"/>
    <ellipse cx="${width / 2}" cy="${height * 0.42}" rx="${width * 0.16}" ry="${height * 0.1}" fill="${palette.fill}"/>
    <circle cx="${width * 0.42}" cy="${height * 0.26}" r="${width * 0.03}" fill="${palette.grain}"/>
    <circle cx="${width * 0.58}" cy="${height * 0.27}" r="${width * 0.03}" fill="${palette.grain}"/>
  </svg>`;

  const noise = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 20 + (seed % 40), g: 18, b: 16, alpha: 0 }
    }
  })
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png()
    .toBuffer();

  return noise;
}

async function main() {
  const entries = await getAllEntries();
  const now = "2026-10-12T00:00:00Z";

  for (const [index, entry] of entries.entries()) {
    const width = 280 + (index % 4) * 40;
    const height = 360 + (index % 3) * 50;
    const originalBytes = await makeSilhouette(index, width, height, PALETTES[index % PALETTES.length]);
    await processCutout({
      id: `${entry.id}-fixture-cutout`.slice(0, 120),
      displayName: entry.displayName,
      entryId: entry.id,
      sourceTitle: entry.titleOfWork,
      licenseBasis: "synthetic-layout-fixture",
      notes: "Generated silhouette for collage layout preview. Not a likeness.",
      originalBytes,
      provider: new PassthroughProvider("fixture"),
      displayAllowed: true,
      synthetic: true,
      status: "collage-ready",
      now
    });
  }

  console.log(`Wrote ${entries.length} synthetic collage fixtures. Assets are gitignored.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
