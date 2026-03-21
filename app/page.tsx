import Link from "next/link";

import { CollectionInlineCard } from "@/src/components/archive/collection-inline-card";
import { RecordRow } from "@/src/components/archive/record-row";
import { SearchBar } from "@/src/components/search/search-bar";
import {
  buildArchiveHref,
  formatMediumLabel,
  formatVariantLabel,
  formatVerificationLabel,
  getArchiveCounts,
  getArchiveEntries,
  getInlineCollections,
  getPublishedEntries,
  hasActiveArchiveFilters,
  parseArchiveQuery
} from "@/src/lib/archive";
import { getAllCollections, getAllEntries, getTaxonomy } from "@/src/lib/content";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "As Steve on TV",
  description: "An ongoing editorial index of Steve sightings across screen culture."
});

function formatFiledDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const [entries, collections, taxonomy] = await Promise.all([getAllEntries(), getAllCollections(), getTaxonomy()]);
  const query = parseArchiveQuery(resolvedSearchParams, taxonomy);
  const archiveEntries = getArchiveEntries(entries, collections, query);
  const inlineCollections = getInlineCollections(archiveEntries, collections);
  const archiveCounts = getArchiveCounts(entries);
  const unresolvedEntries = getPublishedEntries(entries)
    .filter((entry) => ["needs_verification", "disputed"].includes(entry.verificationStatus))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 3);
  const inlineCollection =
    collections.find((collection) => collection.id === "commercial-steves-with-unreasonably-strong-aura") ?? collections[0];
  const secondaryInlineCollection = inlineCollections.find((collection) => collection.id !== inlineCollection?.id) ?? null;
  const railCollection =
    collections.find((collection) => collection.id === "patron-saints-of-sitcom-steve") ?? collections[0];
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
        <p className="archive-page__framing">An ongoing editorial index of Steve sightings across screen culture.</p>
        <dl className="archive-stats">
          <div>
            <dt>Records</dt>
            <dd>{archiveCounts.total}</dd>
          </div>
          <div>
            <dt>Verified</dt>
            <dd>{archiveCounts.verified}</dd>
          </div>
          <div>
            <dt>Unresolved</dt>
            <dd>{archiveCounts.unresolved}</dd>
          </div>
          <div>
            <dt>Latest filing</dt>
            <dd>{formatFiledDate(archiveCounts.latestFiledAt)}</dd>
          </div>
        </dl>
      </header>

      <div className="archive-layout">
        <section className="archive-main">
          <div className="archive-controls">
            <SearchBar
              action="/"
              buttonLabel="Search"
              defaultValue={query.q}
              hiddenFields={hiddenSearchFields}
              placeholder="Steve Urkel, commercial, babysitter, Steven..."
            />

            <div className="archive-controls__group">
              <p className="section-label">Sort</p>
              <div className="archive-tabs">
                {[
                  { value: "canon", label: "Canon" },
                  { value: "newest", label: "Newest" },
                  { value: "needs-verification", label: "Needs verification" }
                ].map((item) => (
                  <Link
                    className={`archive-tab${query.sort === item.value ? " archive-tab--active" : ""}`}
                    href={buildArchiveHref(query, { sort: item.value as typeof query.sort })}
                    key={item.value}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="archive-controls__group">
              <p className="section-label">Medium</p>
              <div className="archive-chip-row">
                {taxonomy.mediums.map((medium) => (
                  <Link
                    className={`archive-chip${query.medium === medium ? " archive-chip--active" : ""}`}
                    href={buildArchiveHref(query, { medium: query.medium === medium ? null : medium })}
                    key={medium}
                  >
                    {formatMediumLabel(medium)}
                  </Link>
                ))}
              </div>
            </div>

            <div className="archive-controls__group">
              <p className="section-label">Variant</p>
              <div className="archive-chip-row">
                {taxonomy.nameVariants.map((variant) => (
                  <Link
                    className={`archive-chip${query.variant === variant ? " archive-chip--active" : ""}`}
                    href={buildArchiveHref(query, { variant: query.variant === variant ? null : variant })}
                    key={variant}
                  >
                    {formatVariantLabel(variant)}
                  </Link>
                ))}
              </div>
            </div>

            <div className="archive-controls__group">
              <p className="section-label">Decade</p>
              <div className="archive-chip-row">
                {taxonomy.eraTags.map((era) => (
                  <Link
                    className={`archive-chip${query.decade === era ? " archive-chip--active" : ""}`}
                    href={buildArchiveHref(query, { decade: query.decade === era ? null : era })}
                    key={era}
                  >
                    {era}
                  </Link>
                ))}
              </div>
            </div>

            <div className="archive-controls__group">
              <p className="section-label">Status</p>
              <div className="archive-chip-row">
                {taxonomy.publicRecordStatuses.map((status) => (
                  <Link
                    className={`archive-chip${query.status === status ? " archive-chip--active" : ""}`}
                    href={buildArchiveHref(query, { status: query.status === status ? null : status })}
                    key={status}
                  >
                    {formatVerificationLabel(status)}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="archive-list-header">
            <p className="section-label">Archive</p>
            <div className="archive-list-header__right">
              <p>{archiveEntries.length} records on view</p>
              {hasActiveArchiveFilters(query) ? (
                <Link className="text-link" href="/">
                  Clear filing state
                </Link>
              ) : null}
            </div>
          </div>

          {archiveEntries.length ? (
            <div className="archive-list">
              {archiveEntries.map((entry, index) => (
                <div className="archive-list__item" key={entry.id}>
                  <RecordRow entry={entry} />
                  {inlineCollection && index === 4 ? <CollectionInlineCard collection={inlineCollection} /> : null}
                  {secondaryInlineCollection && index === 8 ? (
                    <CollectionInlineCard collection={secondaryInlineCollection} />
                  ) : null}
                  {index === Math.max(1, archiveEntries.length - 2) ? (
                    <aside className="archive-maintenance">
                      <p className="section-label">Archive maintenance</p>
                      <h2>Missing a Steve?</h2>
                      <p>
                        Commercial Steves, one-episode Stevens, and poorly documented sightings are the point of the
                        submission system.
                      </p>
                      <Link className="text-link" href="/submit">
                        Report a Steve
                      </Link>
                    </aside>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <section className="archive-empty">
              <p className="section-label">No records found</p>
              <h2>No Steve matched this filing state.</h2>
              <p>Try removing a filter, or search by title, performer, or a looser variant.</p>
              <Link className="text-link" href="/">
                Clear the archive query
              </Link>
            </section>
          )}
        </section>

        <aside className="archive-rail">
          <section className="rail-card">
            <p className="section-label">Method</p>
            <h2>The archive is public. The judgment is editorial.</h2>
            <p>Each record keeps its certainty level visible instead of pretending every sighting is equally settled.</p>
            <Link className="text-link" href="/method">
              Read the method
            </Link>
          </section>

          <section className="rail-card">
            <p className="section-label">Unresolved sightings</p>
            <ul className="rail-list">
              {unresolvedEntries.map((entry) => (
                <li key={entry.id}>
                  <Link href={`/steves/${entry.slug}`}>{entry.displayName}</Link>
                  <span>{formatVerificationLabel(entry.verificationStatus)}</span>
                </li>
              ))}
            </ul>
          </section>

          {railCollection ? (
            <section className="rail-card">
              <p className="section-label">Collection</p>
              <h2>
                <Link href={`/collections/${railCollection.slug}`}>{railCollection.title}</Link>
              </h2>
              <p>{railCollection.dek}</p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
