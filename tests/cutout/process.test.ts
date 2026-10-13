import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { cutoutIdFromName, extractMaskAndTrim, measureOpaqueRegion, processCutout } from "../../src/lib/cutout/process";
import { PassthroughProvider } from "../../src/lib/cutout/remove-bg";
import { isPublicCollageCutout } from "../../src/lib/schema/cutout";

async function opaquePersonPng() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240">
    <rect width="200" height="240" fill="none"/>
    <circle cx="100" cy="70" r="40" fill="#6b4a32"/>
    <rect x="55" y="110" width="90" height="110" rx="18" fill="#6b4a32"/>
  </svg>`;

  return sharp({
    create: { width: 200, height: 240, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
}

async function crowdedScenePng() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240">
    <rect width="400" height="240" fill="#88a"/>
    <circle cx="80" cy="110" r="50" fill="#c45"/>
    <circle cx="280" cy="100" r="55" fill="#6b4a32"/>
    <rect x="230" y="145" width="100" height="80" fill="#6b4a32"/>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

test("strips apostrophes so Blue's Clues does not become blue-s-clues", () => {
  assert.equal(cutoutIdFromName("Steve Burns", "Blue's Clues"), "steve-burns-blues-clues");
  assert.equal(cutoutIdFromName("Stevie Budd", "Schitt's Creek"), "stevie-budd-schitts-creek");
});

test("trims transparent padding and writes a mask", async () => {
  const padded = await sharp(await opaquePersonPng())
    .extend({ top: 40, bottom: 40, left: 40, right: 40, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const measured = await measureOpaqueRegion(padded);
  assert.ok(measured.box.width < 200);
  assert.ok(measured.box.height < 240);

  const extracted = await extractMaskAndTrim(padded);
  const maskMeta = await sharp(extracted.mask).metadata();
  assert.equal(maskMeta.width, extracted.trimmedBox.width);
  assert.equal(maskMeta.channels, 1);
});

test("rejects an empty silhouette", async () => {
  const empty = await sharp({
    create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .png()
    .toBuffer();

  await assert.rejects(() => measureOpaqueRegion(empty), /usable silhouette/);
});

test("writes original, cutout, mask, and rights-gated metadata", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "steve-cutout-"));
  const record = await processCutout({
    id: "steve-test-cutout",
    displayName: "Steve Test",
    sourceTitle: "Unit Test",
    originalBytes: await opaquePersonPng(),
    provider: new PassthroughProvider("fixture"),
    outputRoot,
    now: "2026-10-12T00:00:00Z",
    synthetic: true
  });

  assert.equal(record.imageRights.displayAllowed, false);
  assert.equal(record.status, "draft");
  assert.equal(isPublicCollageCutout(record), false);
  assert.equal(record.provider, "fixture");

  const cutoutBytes = await readFile(path.join(outputRoot, "assets", record.id, "cutout.webp"));
  const maskBytes = await readFile(path.join(outputRoot, "assets", record.id, "mask.png"));
  const originalBytes = await readFile(path.join(outputRoot, "assets", record.id, "original.png"));
  assert.ok(cutoutBytes.length > 32);
  assert.ok(maskBytes.length > 32);
  assert.ok(originalBytes.length > 32);
});

test("selection crops the crowded frame before isolation", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "steve-cutout-"));
  const scene = await crowdedScenePng();

  const unselected = await processCutout({
    id: "steve-crowded-pass",
    displayName: "Steve Crowded",
    sourceTitle: "Crowd Scene",
    originalBytes: scene,
    provider: new PassthroughProvider(),
    outputRoot,
    now: "2026-10-12T00:00:00Z"
  });

  const selected = await processCutout({
    id: "steve-crowded-selected",
    displayName: "Steve Crowded",
    sourceTitle: "Crowd Scene",
    originalBytes: scene,
    selection: { x: 220, y: 40, width: 140, height: 190 },
    provider: new PassthroughProvider(),
    outputRoot,
    now: "2026-10-12T00:00:00Z"
  });

  assert.ok(unselected.trimmedBox.width > selected.trimmedBox.width);
  assert.ok(selected.trimmedBox.width <= 140);
  assert.ok(selected.selection);
});
