import { getContentRepository } from "../src/lib/content/repository";
import {
  listCandidatesFromFilesystem,
  listCollectionsFromFilesystem,
  listEntriesFromFilesystem,
  listIngestRunsFromFilesystem
} from "../src/lib/content/repository-filesystem";

async function main() {
  const repository = getContentRepository();
  const [entries, collections, candidates, ingestRuns] = await Promise.all([
    listEntriesFromFilesystem(),
    listCollectionsFromFilesystem(),
    listCandidatesFromFilesystem(),
    listIngestRunsFromFilesystem()
  ]);

  await repository.upsertPublishedEntries(entries);
  await repository.upsertCollections(collections);
  await repository.upsertCandidates(candidates);

  for (const run of ingestRuns) {
    await repository.upsertIngestRun(run);
  }

  console.log("Fixture content synced to Postgres.");
  console.log(`- published entries: ${entries.length}`);
  console.log(`- collections: ${collections.length}`);
  console.log(`- candidates: ${candidates.length}`);
  console.log(`- ingest runs: ${ingestRuns.length}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Fixture sync failed.");
  console.error(message);
  process.exit(1);
});
