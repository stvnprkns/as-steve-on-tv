import { runImdbBulkIngest } from "../src/lib/ingest/imdb-bulk";

async function main() {
  const result = await runImdbBulkIngest();

  if (result.skipped) {
    console.log("IMDb ingest skipped.");
    console.log(`- dataset fingerprint: ${result.datasetFingerprint}`);
    console.log("- no source changes detected since the last completed run");
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.log("IMDb ingest dry run complete.");
    console.log(`- dataset fingerprint: ${result.datasetFingerprint}`);
    console.log(`- records scanned: ${result.recordsScanned}`);
    console.log(`- source titles: ${result.sourceTitles}`);
    console.log(`- source people: ${result.sourcePeople}`);
    console.log(`- candidates created: ${result.candidatesCreated}`);
    console.log(`- candidates updated: ${result.candidatesUpdated}`);
    console.log(`- candidates matched to published entries: ${result.candidatesMerged}`);
    console.log(`- unchanged candidates skipped: ${result.candidatesSkipped}`);
    console.log(`- first candidate: ${result.firstCandidate ?? "none"}`);
    return;
  }

  console.log("IMDb ingest completed.");
  console.log(`- dataset fingerprint: ${result.datasetFingerprint}`);
  console.log(`- records scanned: ${result.recordsScanned}`);
  console.log(`- candidates created: ${result.candidatesCreated}`);
  console.log(`- candidates updated: ${result.candidatesUpdated}`);
  console.log(`- candidates matched to published entries: ${result.candidatesMerged}`);
  console.log(`- unchanged candidates skipped: ${result.candidatesSkipped}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("IMDb ingest failed.");
  console.error(message);
  process.exit(1);
});
