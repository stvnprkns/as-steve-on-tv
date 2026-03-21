import type { Collection, SteveEntry, Submission, TaxonomyData } from "@/src/lib/schema";
import { loadCollections } from "@/src/lib/content/load-collections";
import { loadEntries } from "@/src/lib/content/load-entries";
import { loadSubmissions } from "@/src/lib/content/load-submissions";
import { loadTaxonomy } from "@/src/lib/content/load-taxonomy";

type ContentBundle = {
  entries: SteveEntry[];
  collections: Collection[];
  submissions: Submission[];
  taxonomy: TaxonomyData;
};

let cache: Promise<ContentBundle> | null = null;

function validateRelationships(entries: SteveEntry[], collections: Collection[], submissions: Submission[]) {
  const entryIds = new Set(entries.map((entry) => entry.id));
  const collectionIds = new Set(collections.map((collection) => collection.id));

  for (const entry of entries) {
    for (const relatedId of entry.relatedEntryIds) {
      if (!entryIds.has(relatedId)) {
        throw new Error(`Entry ${entry.id} references unknown related entry ${relatedId}`);
      }
    }

    for (const collectionId of entry.collectionIds) {
      if (!collectionIds.has(collectionId)) {
        throw new Error(`Entry ${entry.id} references unknown collection ${collectionId}`);
      }
    }
  }

  for (const collection of collections) {
    for (const entryId of collection.entryIds) {
      if (!entryIds.has(entryId)) {
        throw new Error(`Collection ${collection.id} references unknown entry ${entryId}`);
      }
    }
  }

  for (const submission of submissions) {
    if (submission.linkedEntryId && !entryIds.has(submission.linkedEntryId)) {
      throw new Error(`Submission ${submission.id} references unknown linked entry ${submission.linkedEntryId}`);
    }
  }
}

async function buildBundle(): Promise<ContentBundle> {
  const [taxonomy, entries, collections, submissions] = await Promise.all([
    loadTaxonomy(),
    loadEntries(),
    loadCollections(),
    loadSubmissions()
  ]);

  validateRelationships(entries, collections, submissions);

  return {
    taxonomy,
    entries,
    collections,
    submissions
  };
}

async function getBundle() {
  if (!cache) {
    cache = buildBundle();
  }

  return cache;
}

export async function getAllEntries(): Promise<SteveEntry[]> {
  return (await getBundle()).entries;
}

export async function getEntryBySlug(slug: string): Promise<SteveEntry | null> {
  return (await getBundle()).entries.find((entry) => entry.slug === slug) ?? null;
}

export async function getAllCollections(): Promise<Collection[]> {
  return (await getBundle()).collections;
}

export async function getCollectionBySlug(slug: string): Promise<Collection | null> {
  return (await getBundle()).collections.find((collection) => collection.slug === slug) ?? null;
}

export async function getAllSubmissions(): Promise<Submission[]> {
  return (await getBundle()).submissions;
}

export async function getTaxonomy(): Promise<TaxonomyData> {
  return (await getBundle()).taxonomy;
}
