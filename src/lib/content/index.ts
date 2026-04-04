import type {
  CandidateEntry,
  Collection,
  IngestRun,
  SteveEntry,
  Submission,
  TaxonomyData
} from "@/src/lib/schema";
import {
  buildPublicArchiveManifest,
  loadPublicArchiveManifest,
  loadPublicCollectionArtifact,
  loadPublicEntryArtifact,
  loadPublicSearchArtifact
} from "@/src/lib/content/public-artifacts";
import { getContentRepository } from "@/src/lib/content/repository";
import { buildSearchIndex } from "@/src/lib/search/build-search-index";

type OperationalBundle = {
  entries: SteveEntry[];
  collections: Collection[];
  submissions: Submission[];
  taxonomy: TaxonomyData;
  candidates: CandidateEntry[];
  ingestRuns: IngestRun[];
};

let operationalCache: Promise<OperationalBundle> | null = null;

function validateRelationships(entries: SteveEntry[], collections: Collection[], submissions: Submission[], candidates: CandidateEntry[]) {
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

  for (const candidate of candidates) {
    if (candidate.linkedPublishedEntryId && !entryIds.has(candidate.linkedPublishedEntryId)) {
      throw new Error(`Candidate ${candidate.id} references unknown published entry ${candidate.linkedPublishedEntryId}`);
    }
  }
}

async function buildOperationalBundle(): Promise<OperationalBundle> {
  const repository = getContentRepository();
  const [taxonomy, entries, collections, submissions, candidates, ingestRuns] = await Promise.all([
    repository.getTaxonomy(),
    repository.listEntries(),
    repository.listCollections(),
    repository.listSubmissions(),
    repository.listReviewQueue(),
    repository.listIngestRuns()
  ]);

  validateRelationships(entries, collections, submissions, candidates);

  return {
    taxonomy,
    entries,
    collections,
    submissions,
    candidates,
    ingestRuns
  };
}

async function getOperationalBundle() {
  if (!operationalCache) {
    operationalCache = buildOperationalBundle();
  }

  return operationalCache;
}

async function getPublicManifest() {
  return loadPublicArchiveManifest().catch(async () => {
    const bundle = await getOperationalBundle();
    return buildPublicArchiveManifest(bundle.entries, bundle.collections);
  });
}

export async function getArchiveManifest() {
  return getPublicManifest();
}

export async function getSearchDocuments() {
  try {
    return (await loadPublicSearchArtifact()).documents;
  } catch {
    const bundle = await getOperationalBundle();
    return buildSearchIndex(bundle.entries, bundle.collections);
  }
}

export async function getAllEntries(): Promise<SteveEntry[]> {
  return (await getPublicManifest()).entries;
}

export async function getEntryBySlug(slug: string): Promise<SteveEntry | null> {
  return loadPublicEntryArtifact(slug);
}

export async function getAllCollections(): Promise<Collection[]> {
  return (await getPublicManifest()).collections;
}

export async function getCollectionBySlug(slug: string): Promise<Collection | null> {
  return loadPublicCollectionArtifact(slug);
}

export async function getAllSubmissions(): Promise<Submission[]> {
  return (await getOperationalBundle()).submissions;
}

export async function getTaxonomy(): Promise<TaxonomyData> {
  return (await getOperationalBundle()).taxonomy;
}

export async function getReviewQueue(): Promise<CandidateEntry[]> {
  return (await getOperationalBundle()).candidates;
}

export async function getIngestRuns(): Promise<IngestRun[]> {
  return (await getOperationalBundle()).ingestRuns;
}
