import { ZodError } from "zod";

import { steveEntrySchema, type SteveEntry } from "@/src/lib/schema";
import { readJsonFilesFromDirectory, getContentPath } from "@/src/lib/utils/fs";
import { compareByDisplayName } from "@/src/lib/utils/sort";

function ensureUniqueEntries(entries: SteveEntry[]) {
  const idSet = new Set<string>();
  const slugSet = new Set<string>();

  for (const entry of entries) {
    if (idSet.has(entry.id)) {
      throw new Error(`Duplicate entry id detected: ${entry.id}`);
    }

    if (slugSet.has(entry.slug)) {
      throw new Error(`Duplicate entry slug detected: ${entry.slug}`);
    }

    idSet.add(entry.id);
    slugSet.add(entry.slug);
  }
}

export async function loadEntries(): Promise<SteveEntry[]> {
  const rows = await readJsonFilesFromDirectory<unknown>(getContentPath("entries"));
  const entries = rows.map(({ absolutePath, data }) => {
    try {
      return steveEntrySchema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error(`Entry validation failed for ${absolutePath}: ${error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
      }

      throw error;
    }
  });

  ensureUniqueEntries(entries);

  return [...entries].sort(compareByDisplayName);
}
