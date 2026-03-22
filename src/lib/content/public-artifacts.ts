import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getArchiveCounts } from "@/src/lib/archive";
import { buildSearchIndex } from "@/src/lib/search/build-search-index";
import {
  collectionSchema,
  publicArchiveManifestSchema,
  steveEntrySchema,
  type Collection,
  type PublicArchiveManifest,
  type SteveEntry
} from "@/src/lib/schema";
import { getContentPath } from "@/src/lib/utils/fs";

const publicRoot = getContentPath("public");
const entriesRoot = getContentPath("public", "entries");
const collectionsRoot = getContentPath("public", "collections");
const manifestPath = getContentPath("public", "archive-manifest.json");

let manifestCache: Promise<PublicArchiveManifest> | null = null;

export function buildPublicArchiveManifest(entries: SteveEntry[], collections: Collection[]): PublicArchiveManifest {
  const publishedEntries = entries.filter((entry) => entry.status === "published").map((entry) => steveEntrySchema.parse(entry));
  const publishedCollections = collections
    .filter((collection) => collection.status === "published")
    .map((collection) => collectionSchema.parse(collection));

  return publicArchiveManifestSchema.parse({
    generatedAt: new Date().toISOString(),
    counts: getArchiveCounts(publishedEntries),
    entries: publishedEntries,
    collections: publishedCollections,
    searchDocuments: buildSearchIndex(publishedEntries, publishedCollections)
  });
}

export async function loadPublicArchiveManifest() {
  if (!manifestCache) {
    manifestCache = readPublicArchiveManifest();
  }

  return manifestCache;
}

async function readPublicArchiveManifest() {
  const raw = await readFile(manifestPath, "utf8");
  return publicArchiveManifestSchema.parse(JSON.parse(raw) as unknown);
}

export async function writePublicArchiveArtifacts(manifest: PublicArchiveManifest) {
  await mkdir(entriesRoot, { recursive: true });
  await mkdir(collectionsRoot, { recursive: true });
  await mkdir(publicRoot, { recursive: true });

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await Promise.all(
    manifest.entries.map((entry) =>
      writeFile(path.join(entriesRoot, `${entry.slug}.json`), `${JSON.stringify(entry, null, 2)}\n`, "utf8")
    )
  );

  await Promise.all(
    manifest.collections.map((collection) =>
      writeFile(path.join(collectionsRoot, `${collection.slug}.json`), `${JSON.stringify(collection, null, 2)}\n`, "utf8")
    )
  );
}

export async function loadPublicEntryArtifact(slug: string) {
  try {
    const raw = await readFile(path.join(entriesRoot, `${slug}.json`), "utf8");
    return steveEntrySchema.parse(JSON.parse(raw) as unknown);
  } catch {
    const manifest = await loadPublicArchiveManifest();
    return manifest.entries.find((entry) => entry.slug === slug) ?? null;
  }
}

export async function loadPublicCollectionArtifact(slug: string) {
  try {
    const raw = await readFile(path.join(collectionsRoot, `${slug}.json`), "utf8");
    return collectionSchema.parse(JSON.parse(raw) as unknown);
  } catch {
    const manifest = await loadPublicArchiveManifest();
    return manifest.collections.find((collection) => collection.slug === slug) ?? null;
  }
}
