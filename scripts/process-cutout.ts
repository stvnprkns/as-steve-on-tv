import { readFile } from "node:fs/promises";
import path from "node:path";

import { processCutout } from "../src/lib/cutout/process";
import type { PixelBox } from "../src/lib/schema/cutout";

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function parseRoi(value?: string): PixelBox | undefined {
  if (!value) {
    return undefined;
  }

  const [x, y, width, height] = value.split(",").map((part) => Number(part));
  if (![x, y, width, height].every((part) => Number.isFinite(part))) {
    throw new Error("ROI must be x,y,width,height");
  }

  return { x, y, width, height };
}

async function main() {
  const file = readArg("--file");
  const displayName = readArg("--name");
  const sourceTitle = readArg("--source-title") ?? readArg("--work");

  if (!file || !displayName || !sourceTitle) {
    throw new Error("Usage: npm run cutout:process -- --file ./steve.png --name \"Steve Harrington\" --source-title \"Stranger Things\"");
  }

  const originalBytes = await readFile(path.resolve(file));
  const record = await processCutout({
    displayName,
    sourceTitle,
    entryId: readArg("--entry"),
    sourceUrl: readArg("--source-url"),
    attribution: readArg("--attribution"),
    licenseBasis: readArg("--license-basis"),
    notes: readArg("--notes"),
    cropType: readArg("--crop") === "face" ? "face" : "upper-body",
    selection: parseRoi(readArg("--roi")),
    originalBytes,
    originalFileName: path.basename(file)
  });

  console.log(`Wrote cutout ${record.id}`);
  console.log(`- original: ${record.assets.original}`);
  console.log(`- cutout: ${record.assets.cutout}`);
  console.log(`- mask: ${record.assets.mask}`);
  console.log(`- displayAllowed: ${record.imageRights.displayAllowed}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
