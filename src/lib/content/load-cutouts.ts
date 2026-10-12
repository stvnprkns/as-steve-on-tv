import { access } from "node:fs/promises";
import { ZodError } from "zod";

import { steveCutoutSchema, type SteveCutout } from "@/src/lib/schema/cutout";
import { getCutoutRecordsDirectory } from "@/src/lib/cutout/paths";
import { readJsonFilesFromDirectory } from "@/src/lib/utils/fs";

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadCutouts(): Promise<SteveCutout[]> {
  const directory = getCutoutRecordsDirectory();
  if (!(await fileExists(directory))) {
    return [];
  }

  const rows = await readJsonFilesFromDirectory<unknown>(directory);
  const cutouts = rows.map(({ absolutePath, data }) => {
    try {
      return steveCutoutSchema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error(
          `Cutout validation failed for ${absolutePath}: ${error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`
        );
      }

      throw error;
    }
  });

  const ids = new Set<string>();
  for (const cutout of cutouts) {
    if (ids.has(cutout.id)) {
      throw new Error(`Duplicate cutout id detected: ${cutout.id}`);
    }
    ids.add(cutout.id);
  }

  return cutouts.sort((left, right) => left.displayName.localeCompare(right.displayName));
}
