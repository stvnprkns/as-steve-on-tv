import { buildPublicArchiveManifest, writePublicArchiveArtifacts } from "../src/lib/content/public-artifacts";
import { getContentRepository } from "../src/lib/content/repository";

async function main() {
  const repository = getContentRepository();
  const [entries, collections] = await Promise.all([repository.listEntries(), repository.listCollections()]);
  const manifest = buildPublicArchiveManifest(entries, collections);

  await writePublicArchiveArtifacts(manifest);

  console.log("Public artifacts generated.");
  console.log(`- entries: ${manifest.entries.length}`);
  console.log(`- collections: ${manifest.collections.length}`);
  console.log(`- search documents: ${manifest.searchDocuments.length}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Artifact generation failed.");
  console.error(message);
  process.exit(1);
});
