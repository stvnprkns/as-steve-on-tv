import {
  buildPublicArchiveManifest,
  buildPublicListArtifacts,
  buildPublicSearchArtifact,
  writePublicArchiveArtifacts
} from "../src/lib/content/public-artifacts";
import { getContentRepository } from "../src/lib/content/repository";

async function main() {
  const repository = getContentRepository();
  const [entries, collections] = await Promise.all([repository.listEntries(), repository.listCollections()]);
  const publishedEntries = entries.filter((entry) => entry.status === "published");
  const publishedCollections = collections.filter((collection) => collection.status === "published");
  const manifest = buildPublicArchiveManifest(publishedEntries, publishedCollections);
  const searchArtifact = buildPublicSearchArtifact(publishedEntries, publishedCollections);
  const listArtifacts = buildPublicListArtifacts(publishedEntries, publishedCollections);

  await writePublicArchiveArtifacts(manifest, searchArtifact, listArtifacts);

  console.log("Public artifacts generated.");
  console.log(`- entries: ${manifest.entries.length}`);
  console.log(`- collections: ${manifest.collections.length}`);
  console.log(`- search documents: ${searchArtifact.documents.length}`);
  console.log(`- list artifacts: ${listArtifacts.length}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Artifact generation failed.");
  console.error(message);
  process.exit(1);
});
