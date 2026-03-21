import { CollectionCard } from "@/src/components/cards/collection-card";
import { EntryCard } from "@/src/components/cards/entry-card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { SectionHeader } from "@/src/components/ui/section-header";
import type { RankedSearchResult } from "@/src/lib/search/search-entries";
import type { Collection, SteveEntry } from "@/src/lib/schema";

export function SearchResults({
  query,
  total,
  entries,
  collections,
  entryMap,
  collectionMap
}: {
  query: string;
  total: number;
  entries: RankedSearchResult[];
  collections: RankedSearchResult[];
  entryMap: Map<string, SteveEntry>;
  collectionMap: Map<string, Collection>;
}) {
  if (!total) {
    return (
      <EmptyState
        eyebrow="No filing found"
        title={`No results for "${query}"`}
        description="Try a display name, title of work, performer, or a simpler Steve-shaped query."
        links={[
          { href: "/search?q=Steve+Urkel", label: "Try Steve Urkel" },
          { href: "/search?q=Blue%27s+Clues", label: "Try Blue's Clues" },
          { href: "/search?q=Steven", label: "Try Steven" }
        ]}
      />
    );
  }

  return (
    <div className="stack">
      <SectionHeader
        eyebrow="Search results"
        title={`Found ${total} result${total === 1 ? "" : "s"} for "${query}"`}
        description="Entries lead the filing. Collections appear only when they meaningfully clarify the trail."
      />

      <section className="stack">
        <SectionHeader
          eyebrow="Entries first"
          title={`Steve entries (${entries.length})`}
          description="The archive's primary units."
        />
        {entries.length ? (
          <div className="grid grid--two">
            {entries.map((result) => {
              const entry = entryMap.get(result.id);

              return entry ? <EntryCard entry={entry} key={entry.id} variant="compact" /> : null;
            })}
          </div>
        ) : (
          <EmptyState
            eyebrow="No direct entry match"
            title="No Steve entries matched that phrasing."
            description="The archive did find an editorial shelf, but not a direct filed entry, for this query."
          />
        )}
      </section>

      {collections.length ? (
        <section className="stack">
          <SectionHeader
            eyebrow="Secondary trail"
            title={`Collections (${collections.length})`}
            description="Editorial shelves that deepen the search rather than hijack it."
          />
          <div className="grid grid--two">
            {collections.map((result) => {
              const collection = collectionMap.get(result.id);

              return collection ? <CollectionCard collection={collection} key={collection.id} variant="compact" /> : null;
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
