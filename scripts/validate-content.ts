import { getAllCollections, getAllEntries, getAllSubmissions, getTaxonomy } from "../src/lib/content";
import { buildSearchIndex } from "../src/lib/search/build-search-index";

async function main() {
  const [taxonomy, entries, collections, submissions] = await Promise.all([
    getTaxonomy(),
    getAllEntries(),
    getAllCollections(),
    getAllSubmissions()
  ]);
  const searchDocuments = buildSearchIndex(entries, collections);

  console.log("Content validation passed.");
  console.log(`- taxonomies: ${taxonomy.nameVariants.length} name variants, ${taxonomy.archetypeTags.length} archetypes`);
  console.log(`- entries: ${entries.length}`);
  console.log(`- collections: ${collections.length}`);
  console.log(`- submissions: ${submissions.length}`);
  console.log(`- search documents: ${searchDocuments.length}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Content validation failed.");
  console.error(message);
  process.exit(1);
});
