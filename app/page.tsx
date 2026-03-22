import Link from "next/link";

import { RecordRow } from "@/src/components/archive/record-row";
import { SearchBar } from "@/src/components/search/search-bar";
import {
  buildArchiveHref,
  getArchiveCounts,
  getArchiveEntries,
  hasActiveArchiveFilters,
  parseArchiveQuery
} from "@/src/lib/archive";
import { getAllCollections, getAllEntries, getSearchDocuments, getTaxonomy } from "@/src/lib/content";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "As Steve on TV",
  description: "An ongoing editorial index of Steve sightings across screen culture."
});

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const [entries, collections, taxonomy, searchDocuments] = await Promise.all([
    getAllEntries(),
    getAllCollections(),
    getTaxonomy(),
    getSearchDocuments()
  ]);
  const query = parseArchiveQuery(resolvedSearchParams, taxonomy);
  const archiveEntries = getArchiveEntries(entries, collections, query, searchDocuments);
  const archiveCounts = getArchiveCounts(entries);
  const hiddenSearchFields = Object.fromEntries(
    Object.entries({
      sort: query.sort !== "canon" ? query.sort : "",
      medium: query.medium ?? "",
      variant: query.variant ?? "",
      decade: query.decade ?? "",
      status: query.status ?? ""
    }).filter(([, value]) => value)
  );

  return (
    <div className="archive-page">
      <header className="archive-page__intro">
        <h1 className="archive-page__title">An ongoing editorial index of Steve sightings across screen culture.</h1>
        <p className="archive-page__meta">
          {archiveCounts.total} records / {archiveCounts.verified} verified / {archiveCounts.unresolved} unresolved
        </p>
      </header>

      <section className="archive-controls archive-controls--minimal">
        <SearchBar
          action="/"
          buttonLabel="search"
          defaultValue={query.q}
          hiddenFields={hiddenSearchFields}
          placeholder="Steve Urkel, Steven, commercial..."
        />

        <div className="archive-sort">
          {[
            { value: "canon", label: "canon" },
            { value: "newest", label: "newest" },
            { value: "needs-verification", label: "unresolved" }
          ].map((item) => (
            <Link
              className={`archive-sort__link${query.sort === item.value ? " archive-sort__link--active" : ""}`}
              href={buildArchiveHref(query, { sort: item.value as typeof query.sort })}
              key={item.value}
            >
              {item.label}
            </Link>
          ))}
          {hasActiveArchiveFilters(query) ? (
            <Link className="archive-sort__link" href="/">
              clear
            </Link>
          ) : null}
        </div>
      </section>

      {archiveEntries.length ? (
        <div className="archive-list">
          {archiveEntries.map((entry) => (
            <RecordRow entry={entry} key={entry.id} />
          ))}
        </div>
      ) : (
        <section className="archive-empty">
          <h2>No Steve matched this filing state.</h2>
          <p>Try a broader search or clear the current query.</p>
          <Link className="text-link" href="/">
            Clear query
          </Link>
        </section>
      )}
    </div>
  );
}
