import Link from "next/link";

import { CollectionCard } from "@/src/components/cards/collection-card";
import { EntryCard } from "@/src/components/cards/entry-card";
import { SiteShell } from "@/src/components/layout/site-shell";
import { SearchBar } from "@/src/components/search/search-bar";
import { SearchResults } from "@/src/components/search/search-results";
import { SectionHeader } from "@/src/components/ui/section-header";
import { getAllCollections, getAllEntries } from "@/src/lib/content";
import { getFeaturedEntries, getHomepageCollections, getPublishedEntries } from "@/src/lib/content/selectors";
import { buildSearchIndex } from "@/src/lib/search/build-search-index";
import { searchEntries } from "@/src/lib/search/search-entries";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Search | As Steve on TV",
  description: "Search the archive by Steve name, title of work, performer, or editorial collection."
});

export default async function SearchPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const [entries, collections] = await Promise.all([getAllEntries(), getAllCollections()]);
  const publishedEntries = getPublishedEntries(entries);
  const publishedCollections = collections.filter((collection) => collection.status === "published");
  const searchIndex = buildSearchIndex(publishedEntries, publishedCollections);
  const results = searchEntries(query, searchIndex);
  const entryMap = new Map(publishedEntries.map((entry) => [entry.id, entry]));
  const collectionMap = new Map(publishedCollections.map((collection) => [collection.id, collection]));
  const starterEntries = getFeaturedEntries(publishedEntries);
  const starterCollections = getHomepageCollections(publishedCollections, 2);

  return (
    <SiteShell
      eyebrow="Search the archive"
      title="Find a Steve fast"
      description="Search display names, titles of work, performers, aliases, and editorial text without turning the archive into a database control panel."
    >
      <SearchBar defaultValue={query} />

      {query ? (
        <SearchResults
          collectionMap={collectionMap}
          collections={results.collections}
          entries={results.entries}
          entryMap={entryMap}
          query={query}
          total={results.total}
        />
      ) : (
        <div className="stack">
          <section className="search-prompt-card">
            <p className="kicker">Search prompts</p>
            <div className="search-prompt-card__chips">
              {["Steve Urkel", "Blue's Clues", "Steven", "commercial", "Captain America"].map((suggestion) => (
                <Link className="search-chip" href={`/search?q=${encodeURIComponent(suggestion)}`} key={suggestion}>
                  {suggestion}
                </Link>
              ))}
            </div>
          </section>

          <section className="stack">
            <SectionHeader
              eyebrow="Starter shelf"
              title="A few good places to begin"
              description="If you are not looking for one exact Steve, these entries explain the archive quickly."
            />
            <div className="grid grid--two">
              {starterEntries.map((entry) => (
                <EntryCard entry={entry} key={entry.id} variant="compact" />
              ))}
            </div>
          </section>

          <section className="stack">
            <SectionHeader
              eyebrow="Collections"
              title="Editorial routes"
              description="Search is not the only way in. Collections do some of the cultural filing for you."
            />
            <div className="grid grid--two">
              {starterCollections.map((collection) => (
                <CollectionCard collection={collection} key={collection.id} variant="compact" />
              ))}
            </div>
          </section>
        </div>
      )}
    </SiteShell>
  );
}
