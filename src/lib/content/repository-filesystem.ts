import { loadCandidates } from "@/src/lib/content/load-candidates";
import { loadCollections } from "@/src/lib/content/load-collections";
import { loadEntries } from "@/src/lib/content/load-entries";
import { loadIngestRuns } from "@/src/lib/content/load-ingest-runs";
import { loadSubmissions } from "@/src/lib/content/load-submissions";
import { loadTaxonomy } from "@/src/lib/content/load-taxonomy";

export function listEntriesFromFilesystem() {
  return loadEntries();
}

export function listCollectionsFromFilesystem() {
  return loadCollections();
}

export function listSubmissionsFromFilesystem() {
  return loadSubmissions();
}

export function loadTaxonomyFromFilesystem() {
  return loadTaxonomy();
}

export function listCandidatesFromFilesystem() {
  return loadCandidates();
}

export function listIngestRunsFromFilesystem() {
  return loadIngestRuns();
}
