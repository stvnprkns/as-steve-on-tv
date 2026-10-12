import path from "node:path";

import { getContentPath } from "@/src/lib/utils/fs";

export function getDefaultCutoutRoot() {
  return getContentPath("cutouts");
}

export function getCutoutRecordsDirectory(root = getDefaultCutoutRoot()) {
  return root;
}

export function getCutoutRecordPath(id: string, root = getDefaultCutoutRoot()) {
  return path.join(getCutoutRecordsDirectory(root), `${id}.json`);
}

export function getCutoutAssetDirectory(id: string, root = getDefaultCutoutRoot()) {
  return path.join(getCutoutRecordsDirectory(root), "assets", id);
}

export function getCutoutAssetPath(
  id: string,
  fileName: "original.png" | "cutout.webp" | "mask.png",
  root = getDefaultCutoutRoot()
) {
  return path.join(getCutoutAssetDirectory(id, root), fileName);
}

export function toRepoRelative(absolutePath: string) {
  return path.relative(process.cwd(), absolutePath).split(path.sep).join("/");
}
