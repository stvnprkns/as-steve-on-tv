import {
  getAllCollections,
  getAllEntries,
  getAllSubmissions,
  getIngestRuns,
  getReviewQueue,
  getSearchDocuments,
  getTaxonomy
} from "../src/lib/content";

async function main() {
  const [taxonomy, entries, collections, submissions, candidates, ingestRuns, searchDocuments] = await Promise.all([
    getTaxonomy(),
    getAllEntries(),
    getAllCollections(),
    getAllSubmissions(),
    getReviewQueue(),
    getIngestRuns(),
    getSearchDocuments()
  ]);

  console.log("Content validation passed.");
  console.log(`- taxonomies: ${taxonomy.nameVariants.length} name variants, ${taxonomy.archetypeTags.length} archetypes`);
  console.log(`- entries: ${entries.length}`);
  console.log(`- collections: ${collections.length}`);
  console.log(`- submissions: ${submissions.length}`);
  console.log(`- candidates: ${candidates.length}`);
  console.log(`- ingest runs: ${ingestRuns.length}`);
  console.log(`- search documents: ${searchDocuments.length}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Content validation failed.");
  console.error(message);
  process.exit(1);
});
