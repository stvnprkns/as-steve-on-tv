import assert from "node:assert/strict";
import test from "node:test";

import { findSpriteAtPoint, layoutCutouts } from "../../src/lib/cutout/layout";
import type { SteveCutout } from "../../src/lib/schema/cutout";

function fakeCutout(id: string, width: number, height: number): SteveCutout {
  return {
    id,
    slug: id,
    displayName: id,
    cropType: "upper-body",
    status: "collage-ready",
    provider: "fixture",
    source: { title: "Fixture" },
    trimmedBox: { x: 0, y: 0, width, height },
    assets: {
      original: "original.png",
      cutout: "cutout.webp",
      mask: "mask.png"
    },
    imageRights: {
      displayAllowed: true,
      licenseBasis: "synthetic-layout-fixture"
    },
    createdAt: "2026-10-12T00:00:00Z",
    updatedAt: "2026-10-12T00:00:00Z"
  };
}

test("clusters cutouts instead of appending a strip", () => {
  const cutouts = Array.from({ length: 12 }, (_, index) =>
    fakeCutout(`steve-fixture-${String(index).padStart(2, "0")}`, 80 + index * 6, 140)
  );

  const layout = layoutCutouts(cutouts);
  assert.equal(layout.sprites.length, 12);
  assert.ok(layout.width < 9000);
  assert.ok(layout.height > 400);

  const xs = layout.sprites.map((sprite) => sprite.x);
  const ys = layout.sprites.map((sprite) => sprite.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 80);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 80);

  const same = layoutCutouts(cutouts);
  assert.deepEqual(
    same.sprites.map((sprite) => [sprite.x, sprite.y, sprite.width, sprite.zIndex]),
    layout.sprites.map((sprite) => [sprite.x, sprite.y, sprite.width, sprite.zIndex])
  );
});

test("every sprite stays large enough to click", () => {
  const layout = layoutCutouts([fakeCutout("tiny-steve", 12, 18), fakeCutout("huge-steve", 900, 1200)]);
  for (const sprite of layout.sprites) {
    assert.ok(sprite.width >= 48);
    assert.ok(sprite.height >= 48);
  }
});

test("point lookup prefers the higher sprite", () => {
  const layout = layoutCutouts([fakeCutout("alpha-steve", 100, 140), fakeCutout("beta-steve", 100, 140)]);
  const top = [...layout.sprites].sort((left, right) => right.zIndex - left.zIndex)[0];
  const hit = findSpriteAtPoint(layout, top.x + 8, top.y + 8);
  assert.equal(hit?.cutoutId, top.cutoutId);
});
