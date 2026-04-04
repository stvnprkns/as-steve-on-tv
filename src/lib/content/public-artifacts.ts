import { createHash } from "node:crypto";

import { archiveSorts, getArchiveCounts, getArchiveEntries, type ArchiveSort } from "@/src/lib/archive";
import { getContentRepository } from "@/src/lib/content/repository";
import { readArtifactText, type ArtifactFile, writeArtifactFiles } from "@/src/lib/content/artifact-store";
import { buildSearchIndex } from "@/src/lib/search/build-search-index";
import {
  collectionSchema,
  publicArchiveManifestSchema,
  publicListArtifactSchema,
  publicSearchArtifactSchema,
  steveEntrySchema,
  type Collection,
  type PublicArchiveManifest,
  type PublicListArtifact,
  type PublicSearchArtifact,
  type SteveEntry
} from "@/src/lib/schema";

const MANIFEST_PATH = "archive-manifest.json";
const SEARCH_PATH = "search-documents.json";

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hashContent(value: unknown) {
  return createHash("sha1").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function entryArtifactPath(slug: string) {
  return `entries/${slug}.json`;
}

function collectionArtifactPath(slug: string) {
  return `collections/${slug}.json`;
}

function listArtifactPath(sort: ArchiveSort) {
  return `lists/${sort}.json`;
}

async function readJsonArtifact<T>(
  relativePath: string,
  schema: { parse(value: unknown): T },
  tags: string[]
) {
  const raw = await readArtifactText(relativePath, tags);
  return schema.parse(JSON.parse(raw) as unknown);
}

export function buildPublicArchiveManifest(
  entries: SteveEntry[],
  collections: Collection[],
  options?: { datasetFingerprint?: string }
): PublicArchiveManifest {
  const publishedEntries = entries.filter((entry) => entry.status === "published").map((entry) => steveEntrySchema.parse(entry));
  const publishedCollections = collections
    .filter((collection) => collection.status === "published")
    .map((collection) => collectionSchema.parse(collection));
  const entryCount = publishedEntries.length;
  const base = {
    generatedAt: new Date().toISOString(),
    datasetFingerprint: options?.datasetFingerprint,
    entryCount,
    counts: getArchiveCounts(publishedEntries),
    entries: publishedEntries,
    collections: publishedCollections
  };

  return publicArchiveManifestSchema.parse({
    ...base,
    etag: hashContent(base)
  });
}

export function buildPublicSearchArtifact(entries: SteveEntry[], collections: Collection[]): PublicSearchArtifact {
  const documents = buildSearchIndex(entries, collections);
  const base = {
    generatedAt: new Date().toISOString(),
    documents
  };

  return publicSearchArtifactSchema.parse({
    ...base,
    etag: hashContent(base)
  });
}

export function buildPublicListArtifacts(entries: SteveEntry[], collections: Collection[]) {
  return archiveSorts.map((sort) => {
    const orderedEntries = getArchiveEntries(
      entries,
      collections,
      {
        q: "",
        sort,
        medium: null,
        variant: null,
        decade: null,
        status: null
      }
    );
    const base = {
      generatedAt: new Date().toISOString(),
      sort,
      entries: orderedEntries
    };

    return publicListArtifactSchema.parse({
      ...base,
      etag: hashContent(base)
    });
  });
}

function buildArtifactFiles(
  manifest: PublicArchiveManifest,
  searchArtifact: PublicSearchArtifact,
  listArtifacts: PublicListArtifact[]
): ArtifactFile[] {
  return [
    {
      path: MANIFEST_PATH,
      body: stableJson(manifest)
    },
    {
      path: SEARCH_PATH,
      body: stableJson(searchArtifact)
    },
    ...manifest.entries.map((entry) => ({
      path: entryArtifactPath(entry.slug),
      body: stableJson(entry)
    })),
    ...manifest.collections.map((collection) => ({
      path: collectionArtifactPath(collection.slug),
      body: stableJson(collection)
    })),
    ...listArtifacts.map((artifact) => ({
      path: listArtifactPath(artifact.sort),
      body: stableJson(artifact)
    }))
  ];
}

export async function loadPublicArchiveManifest() {
  return readJsonArtifact(MANIFEST_PATH, publicArchiveManifestSchema, ["archive"]);
}

export async function loadPublicSearchArtifact() {
  return readJsonArtifact(SEARCH_PATH, publicSearchArtifactSchema, ["archive"]);
}

export async function loadPublicEntryArtifact(slug: string) {
  try {
    return await readJsonArtifact(entryArtifactPath(slug), steveEntrySchema, ["archive", `entry:${slug}`]);
  } catch {
    const manifest = await loadPublicArchiveManifest();
    return manifest.entries.find((entry) => entry.slug === slug) ?? null;
  }
}

export async function loadPublicCollectionArtifact(slug: string) {
  try {
    return await readJsonArtifact(collectionArtifactPath(slug), collectionSchema, ["archive", `collection:${slug}`]);
  } catch {
    const manifest = await loadPublicArchiveManifest();
    return manifest.collections.find((collection) => collection.slug === slug) ?? null;
  }
}

export async function loadPublicListArtifact(sort: ArchiveSort) {
  return readJsonArtifact(listArtifactPath(sort), publicListArtifactSchema, ["archive"]);
}

export async function writePublicArchiveArtifacts(
  manifest: PublicArchiveManifest,
  searchArtifact: PublicSearchArtifact,
  listArtifacts: PublicListArtifact[]
) {
  const files = buildArtifactFiles(manifest, searchArtifact, listArtifacts);
  const changedPaths = await writeArtifactFiles(files);
  const changedEntrySlugs = changedPaths
    .filter((filePath) => filePath.startsWith("entries/"))
    .map((filePath) => filePath.replace(/^entries\/|\.json$/g, ""));
  const changedCollectionSlugs = changedPaths
    .filter((filePath) => filePath.startsWith("collections/"))
    .map((filePath) => filePath.replace(/^collections\/|\.json$/g, ""));

  return {
    changedPaths,
    changedEntrySlugs,
    changedCollectionSlugs
  };
}

export async function refreshPublicArtifactsFromRepository() {
  const repository = getContentRepository();
  const [entries, collections, ingestRuns] = await Promise.all([
    repository.listEntries(),
    repository.listCollections(),
    repository.listIngestRuns()
  ]);
  const publishedEntries = entries.filter((entry) => entry.status === "published");
  const publishedCollections = collections.filter((collection) => collection.status === "published");
  const datasetFingerprint = ingestRuns.find((run) => run.provider === "imdb_bulk" && run.status === "completed")?.datasetFingerprint;
  const manifest = buildPublicArchiveManifest(publishedEntries, publishedCollections, { datasetFingerprint });
  const searchArtifact = buildPublicSearchArtifact(publishedEntries, publishedCollections);
  const listArtifacts = buildPublicListArtifacts(publishedEntries, publishedCollections);
  const changeSet = await writePublicArchiveArtifacts(manifest, searchArtifact, listArtifacts);

  return {
    manifest,
    searchArtifact,
    listArtifacts,
    ...changeSet
  };
}
