import { refreshPublicArtifactsFromRepository } from "../src/lib/content/public-artifacts";
import { publishAcceptedCandidatesAndRefreshArtifacts } from "../src/lib/content/publish";
import { runImdbBulkIngest } from "../src/lib/ingest/imdb-bulk";
import { triggerRemoteRevalidation } from "../src/lib/revalidation";

async function main() {
  const autoPublishAccepted = process.env.AUTO_PUBLISH_ACCEPTED === "true";
  const ingest = await runImdbBulkIngest();

  if (ingest.skipped) {
    console.log("IMDb sync skipped.");
    console.log(`- dataset fingerprint: ${ingest.datasetFingerprint}`);

    if (!autoPublishAccepted) {
      return;
    }
  } else {
    console.log("IMDb sync ingest stage complete.");
    console.log(`- candidates created: ${ingest.candidatesCreated}`);
    console.log(`- candidates updated: ${ingest.candidatesUpdated}`);
    console.log(`- candidates matched to published entries: ${ingest.candidatesMerged}`);
    console.log(`- unchanged candidates skipped: ${ingest.candidatesSkipped}`);
  }

  if (autoPublishAccepted) {
    const result = await publishAcceptedCandidatesAndRefreshArtifacts();
    console.log("Accepted candidates published.");
    console.log(`- published: ${result.published}`);
    console.log(`- skipped (incomplete payloads): ${result.skipped}`);
    console.log(`- public entries: ${result.manifest.entries.length}`);

    if (result.changedPaths.length) {
      const revalidation = await triggerRemoteRevalidation({
        tags: [
          "archive",
          ...result.changedEntrySlugs.map((slug) => `entry:${slug}`),
          ...result.changedCollectionSlugs.map((slug) => `collection:${slug}`)
        ],
        slugs: result.changedEntrySlugs,
        collectionSlugs: result.changedCollectionSlugs
      });
      console.log(`- remote revalidation triggered: ${revalidation.triggered}`);
    }

    return;
  }

  const refresh = await refreshPublicArtifactsFromRepository();
  console.log("Public artifacts refreshed.");
  console.log(`- public entries: ${refresh.manifest.entries.length}`);
  console.log(`- changed artifacts: ${refresh.changedPaths.length}`);

  if (refresh.changedPaths.length) {
    const revalidation = await triggerRemoteRevalidation({
      tags: [
        "archive",
        ...refresh.changedEntrySlugs.map((slug) => `entry:${slug}`),
        ...refresh.changedCollectionSlugs.map((slug) => `collection:${slug}`)
      ],
      slugs: refresh.changedEntrySlugs,
      collectionSlugs: refresh.changedCollectionSlugs
    });
    console.log(`- remote revalidation triggered: ${revalidation.triggered}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("IMDb sync failed.");
  console.error(message);
  process.exit(1);
});
