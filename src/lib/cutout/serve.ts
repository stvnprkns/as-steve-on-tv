import { readFile } from "node:fs/promises";
import path from "node:path";

import { getCutoutAssetPath, getDefaultCutoutRoot } from "@/src/lib/cutout/paths";
import { isPublicCollageCutout, type SteveCutout } from "@/src/lib/schema/cutout";

const KINDS = {
  original: { fileName: "original.png" as const, type: "image/png" },
  cutout: { fileName: "cutout.webp" as const, type: "image/webp" },
  mask: { fileName: "mask.png" as const, type: "image/png" }
};

export type CutoutAssetKind = keyof typeof KINDS;

export function parseCutoutAssetKind(value: string | null): CutoutAssetKind | null {
  if (value === "original" || value === "cutout" || value === "mask") {
    return value;
  }
  return null;
}

export async function readCutoutAsset(cutout: SteveCutout, kind: CutoutAssetKind, root = getDefaultCutoutRoot()) {
  const spec = KINDS[kind];
  const stored = path.resolve(
    process.cwd(),
    kind === "original" ? cutout.assets.original : kind === "mask" ? cutout.assets.mask : cutout.assets.cutout
  );
  const expected = path.resolve(getCutoutAssetPath(cutout.id, spec.fileName, root));
  const filePath = stored === expected ? stored : expected;
  const bytes = await readFile(filePath);
  return { bytes, type: spec.type, filePath };
}

export function publicCutoutAllowed(cutout: SteveCutout, kind: CutoutAssetKind) {
  return kind === "cutout" && isPublicCollageCutout(cutout);
}
