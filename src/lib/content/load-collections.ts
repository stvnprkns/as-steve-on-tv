import { ZodError } from "zod";

import { collectionSchema, type Collection } from "@/src/lib/schema";
import { readJsonFilesFromDirectory, getContentPath } from "@/src/lib/utils/fs";
import { compareByTitle } from "@/src/lib/utils/sort";

function ensureUniqueCollections(collections: Collection[]) {
  const idSet = new Set<string>();
  const slugSet = new Set<string>();

  for (const collection of collections) {
    if (idSet.has(collection.id)) {
      throw new Error(`Duplicate collection id detected: ${collection.id}`);
    }

    if (slugSet.has(collection.slug)) {
      throw new Error(`Duplicate collection slug detected: ${collection.slug}`);
    }

    idSet.add(collection.id);
    slugSet.add(collection.slug);
  }
}

export async function loadCollections(): Promise<Collection[]> {
  const rows = await readJsonFilesFromDirectory<unknown>(getContentPath("collections"));
  const collections = rows.map(({ absolutePath, data }) => {
    try {
      return collectionSchema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error(
          `Collection validation failed for ${absolutePath}: ${error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`
        );
      }

      throw error;
    }
  });

  ensureUniqueCollections(collections);

  return [...collections].sort(compareByTitle);
}
