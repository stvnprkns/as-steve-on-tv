import type { SteveCutout } from "@/src/lib/schema/cutout";

export type CollageSprite = {
  cutoutId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
};

export type CollageLayout = {
  width: number;
  height: number;
  sprites: CollageSprite[];
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unit(hash: number, salt: number) {
  const mixed = Math.imul(hash ^ salt, 2654435761) >>> 0;
  return mixed / 0xffffffff;
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

const TARGET_HEIGHT = 220;
const CLUSTER_SIZE = 6;
const CLUSTER_GAP_X = 420;
const CLUSTER_GAP_Y = 380;
const PADDING = 120;

function spriteSize(cutout: SteveCutout, scale: number) {
  const box = cutout.trimmedBox;
  const base = TARGET_HEIGHT / Math.max(box.height, 1);
  const width = Math.max(48, Math.round(box.width * base * scale));
  const height = Math.max(48, Math.round(box.height * base * scale));
  return { width, height };
}

export function layoutCutouts(cutouts: SteveCutout[]): CollageLayout {
  const ordered = [...cutouts].sort((left, right) => left.id.localeCompare(right.id));
  const sprites: CollageSprite[] = [];
  const clusterCount = Math.max(1, Math.ceil(ordered.length / CLUSTER_SIZE));
  const columns = Math.max(1, Math.ceil(Math.sqrt(clusterCount)));

  ordered.forEach((cutout, index) => {
    const hash = hashString(cutout.id);
    const clusterIndex = Math.floor(index / CLUSTER_SIZE);
    const indexInCluster = index % CLUSTER_SIZE;
    const clusterColumn = clusterIndex % columns;
    const clusterRow = Math.floor(clusterIndex / columns);
    const scale = lerp(0.55, 1.85, unit(hash, 11));
    const size = spriteSize(cutout, scale);
    const clusterX = PADDING + clusterColumn * CLUSTER_GAP_X + 40;
    const clusterY = PADDING + clusterRow * CLUSTER_GAP_Y + 40;
    const spiral = indexInCluster * 0.92;
    const radius = 28 + indexInCluster * 42;
    const x = Math.round(clusterX + Math.cos(spiral) * radius + lerp(-36, 48, unit(hash, 23)));
    const y = Math.round(clusterY + Math.sin(spiral) * radius + lerp(-28, 40, unit(hash, 41)));
    const rotation = lerp(-11, 11, unit(hash, 71));

    sprites.push({
      cutoutId: cutout.id,
      x: Math.max(24, x),
      y: Math.max(24, y),
      width: size.width,
      height: size.height,
      rotation,
      zIndex: Math.round(lerp(1, 80, unit(hash, 99))) + indexInCluster
    });
  });

  const width = Math.max(
    1600,
    sprites.reduce((max, sprite) => Math.max(max, sprite.x + sprite.width), 0) + PADDING
  );
  const height = Math.max(
    1200,
    sprites.reduce((max, sprite) => Math.max(max, sprite.y + sprite.height), 0) + PADDING
  );

  return { width, height, sprites };
}

export function findSpriteAtPoint(layout: CollageLayout, x: number, y: number) {
  const hits = layout.sprites
    .filter((sprite) => x >= sprite.x && x <= sprite.x + sprite.width && y >= sprite.y && y <= sprite.y + sprite.height)
    .sort((left, right) => right.zIndex - left.zIndex);

  return hits[0] ?? null;
}
