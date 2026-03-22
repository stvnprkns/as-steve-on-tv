import type {
  CandidateEntry,
  Collection,
  IngestRun,
  SourcePersonRecord,
  SourceTitleRecord,
  SteveEntry,
  Submission,
  TaxonomyData
} from "@/src/lib/schema";
import { hasDatabaseUrl } from "@/src/lib/db/pg";
import {
  acceptCandidate as acceptCandidateInPostgres,
  listCandidatesFromPostgres,
  listCollectionsFromPostgres,
  listEntriesFromPostgres,
  listIngestRunsFromPostgres,
  syncCandidatesToPostgres,
  syncCollectionsToPostgres,
  syncEntriesToPostgres,
  syncIngestRunToPostgres,
  syncSourcePeopleToPostgres,
  syncSourceTitlesToPostgres
} from "@/src/lib/content/repository-postgres";
import {
  listCandidatesFromFilesystem,
  listCollectionsFromFilesystem,
  listEntriesFromFilesystem,
  listIngestRunsFromFilesystem,
  listSubmissionsFromFilesystem,
  loadTaxonomyFromFilesystem
} from "@/src/lib/content/repository-filesystem";

export type ContentRepository = {
  listEntries(): Promise<SteveEntry[]>;
  listCollections(): Promise<Collection[]>;
  listSubmissions(): Promise<Submission[]>;
  getTaxonomy(): Promise<TaxonomyData>;
  listReviewQueue(): Promise<CandidateEntry[]>;
  listIngestRuns(): Promise<IngestRun[]>;
  upsertSourceTitles(records: SourceTitleRecord[]): Promise<void>;
  upsertSourcePeople(records: SourcePersonRecord[]): Promise<void>;
  upsertCandidates(records: CandidateEntry[]): Promise<void>;
  upsertIngestRun(run: IngestRun): Promise<void>;
  upsertPublishedEntries(entries: SteveEntry[]): Promise<void>;
  upsertCollections(collections: Collection[]): Promise<void>;
  acceptCandidate(id: string, publishedEntry: SteveEntry): Promise<void>;
};

function unsupported(operation: string) {
  throw new Error(`${operation} requires DATABASE_URL. The filesystem fallback is read-only.`);
}

const filesystemRepository: ContentRepository = {
  listEntries: listEntriesFromFilesystem,
  listCollections: listCollectionsFromFilesystem,
  listSubmissions: listSubmissionsFromFilesystem,
  getTaxonomy: loadTaxonomyFromFilesystem,
  listReviewQueue: listCandidatesFromFilesystem,
  listIngestRuns: listIngestRunsFromFilesystem,
  upsertSourceTitles: async () => unsupported("upsertSourceTitles"),
  upsertSourcePeople: async () => unsupported("upsertSourcePeople"),
  upsertCandidates: async () => unsupported("upsertCandidates"),
  upsertIngestRun: async () => unsupported("upsertIngestRun"),
  upsertPublishedEntries: async () => unsupported("upsertPublishedEntries"),
  upsertCollections: async () => unsupported("upsertCollections"),
  acceptCandidate: async () => unsupported("acceptCandidate")
};

const postgresRepository: ContentRepository = {
  listEntries: listEntriesFromPostgres,
  listCollections: listCollectionsFromPostgres,
  listSubmissions: listSubmissionsFromFilesystem,
  getTaxonomy: loadTaxonomyFromFilesystem,
  listReviewQueue: listCandidatesFromPostgres,
  listIngestRuns: listIngestRunsFromPostgres,
  upsertSourceTitles: syncSourceTitlesToPostgres,
  upsertSourcePeople: syncSourcePeopleToPostgres,
  upsertCandidates: syncCandidatesToPostgres,
  upsertIngestRun: syncIngestRunToPostgres,
  upsertPublishedEntries: syncEntriesToPostgres,
  upsertCollections: syncCollectionsToPostgres,
  acceptCandidate: acceptCandidateInPostgres
};

export function getContentRepository(): ContentRepository {
  return hasDatabaseUrl() ? postgresRepository : filesystemRepository;
}
