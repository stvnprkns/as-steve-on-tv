import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { steveCutoutSchema, type PixelBox, type SteveCutout } from "@/src/lib/schema/cutout";
import { createCutoutProvider, describeMissingProvider, type CutoutProvider } from "@/src/lib/cutout/remove-bg";
import { getCutoutAssetDirectory, getCutoutRecordPath, getDefaultCutoutRoot, toRepoRelative } from "@/src/lib/cutout/paths";
import { idSchema } from "@/src/lib/schema/common";

const ALPHA_THRESHOLD = 12;
const MIN_OPAQUE_PIXELS = 80;

export type ProcessCutoutInput = {
  id?: string;
  displayName: string;
  entryId?: string;
  cropType?: SteveCutout["cropType"];
  sourceTitle: string;
  sourceUrl?: string;
  attribution?: string;
  licenseBasis?: string;
  notes?: string;
  selection?: PixelBox;
  originalBytes: Buffer;
  originalFileName?: string;
  now?: string;
  provider?: CutoutProvider;
  displayAllowed?: boolean;
  synthetic?: boolean;
  status?: SteveCutout["status"];
  outputRoot?: string;
};

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug.length >= 3 ? slug : `steve-cutout-${Date.now()}`;
}

export function cutoutIdFromName(displayName: string, sourceTitle: string) {
  const id = slugify(`${displayName}-${sourceTitle}`);
  return idSchema.parse(id);
}

async function cropToSelection(image: Buffer, selection?: PixelBox) {
  if (!selection) {
    return image;
  }

  const source = sharp(image);
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (selection.x + selection.width > width || selection.y + selection.height > height) {
    throw new Error("Selection is outside the source image.");
  }

  return source
    .extract({
      left: selection.x,
      top: selection.y,
      width: selection.width,
      height: selection.height
    })
    .png()
    .toBuffer();
}

export async function measureOpaqueRegion(image: Buffer) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > ALPHA_THRESHOLD) {
        opaque += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (opaque < MIN_OPAQUE_PIXELS || maxX < 0) {
    throw new Error(
      "Cutout has no usable silhouette. Draw a box around Steve, or use remove.bg on a frame that is not already empty."
    );
  }

  return {
    opaque,
    box: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    }
  };
}

export async function extractMaskAndTrim(image: Buffer) {
  const measured = await measureOpaqueRegion(image);
  const trimmed = await sharp(image)
    .ensureAlpha()
    .extract({
      left: measured.box.x,
      top: measured.box.y,
      width: measured.box.width,
      height: measured.box.height
    })
    .png()
    .toBuffer();

  const mask = await sharp(trimmed)
    .ensureAlpha()
    .extractChannel("alpha")
    .png()
    .toBuffer();

  const cutout = await sharp(trimmed).webp({ quality: 86, alphaQuality: 100 }).toBuffer();

  return {
    cutout,
    mask,
    trimmedPng: trimmed,
    trimmedBox: measured.box,
    opaquePixels: measured.opaque
  };
}

export async function processCutout(input: ProcessCutoutInput): Promise<SteveCutout> {
  const now = input.now ?? new Date().toISOString();
  const id = input.id ?? cutoutIdFromName(input.displayName, input.sourceTitle);
  const provider = input.provider ?? createCutoutProvider({ fixture: input.synthetic });
  const selected = await cropToSelection(input.originalBytes, input.selection);

  let isolated: Buffer;
  try {
    isolated = await provider.removeBackground(selected);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message} ${describeMissingProvider(input.selection)}`);
  }

  const processed = await extractMaskAndTrim(isolated);
  const outputRoot = input.outputRoot ?? getDefaultCutoutRoot();
  const assetDirectory = getCutoutAssetDirectory(id, outputRoot);
  await mkdir(assetDirectory, { recursive: true });

  const originalPath = path.join(assetDirectory, "original.png");
  const cutoutPath = path.join(assetDirectory, "cutout.webp");
  const maskPath = path.join(assetDirectory, "mask.png");

  const originalPng = await sharp(input.originalBytes).png().toBuffer();
  await writeFile(originalPath, originalPng);
  await writeFile(cutoutPath, processed.cutout);
  await writeFile(maskPath, processed.mask);

  const record = steveCutoutSchema.parse({
    id,
    slug: id,
    displayName: input.displayName,
    entryId: input.entryId,
    cropType: input.cropType ?? "upper-body",
    status: input.status ?? "draft",
    provider: provider.name,
    source: {
      title: input.sourceTitle,
      url: input.sourceUrl,
      attribution: input.attribution,
      notes: input.notes
    },
    selection: input.selection,
    trimmedBox: processed.trimmedBox,
    assets: {
      original: toRepoRelative(originalPath),
      cutout: toRepoRelative(cutoutPath),
      mask: toRepoRelative(maskPath)
    },
    imageRights: {
      displayAllowed: input.displayAllowed ?? false,
      licenseBasis: input.licenseBasis ?? "screenshot-held-for-review",
      attribution: input.attribution,
      sourceUrl: input.sourceUrl
    },
    synthetic: input.synthetic,
    createdAt: now,
    updatedAt: now
  });

  await writeFile(getCutoutRecordPath(id, outputRoot), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

