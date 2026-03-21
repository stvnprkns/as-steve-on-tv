import { notFound } from "next/navigation";

import { CollectionCard } from "@/src/components/cards/collection-card";
import { EntryMeta } from "@/src/components/entries/entry-meta";
import { RelatedEntries } from "@/src/components/entries/related-entries";
import { SiteShell } from "@/src/components/layout/site-shell";
import { EmptyState } from "@/src/components/ui/empty-state";
import { SectionHeader } from "@/src/components/ui/section-header";
import { TagList } from "@/src/components/ui/tag-list";
import { getAllCollections, getAllEntries, getEntryBySlug } from "@/src/lib/content";
import { getPublishedEntries, getRelatedEntries } from "@/src/lib/content/selectors";
import { buildMetadata } from "@/src/lib/seo/metadata";

export async function generateStaticParams() {
  const entries = await getAllEntries();
  return getPublishedEntries(entries).map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await getEntryBySlug(slug);

  if (!entry) {
    return buildMetadata({
      title: "Steve not found | As Steve on TV"
    });
  }

  return buildMetadata({
    title: `${entry.displayName} | As Steve on TV`,
    description: entry.whyItMatters
  });
}

export default async function StevePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [entry, allEntries, allCollections] = await Promise.all([getEntryBySlug(slug), getAllEntries(), getAllCollections()]);

  if (!entry || entry.status !== "published") {
    notFound();
  }

  const relatedEntries = getRelatedEntries(entry, allEntries);
  const relatedCollections = allCollections.filter((collection) => entry.collectionIds.includes(collection.id));
  return (
    <SiteShell
      eyebrow={`${entry.medium} entry`}
      title={entry.displayName}
      description={`${entry.titleOfWork} filed under ${entry.nameVariant}, ${entry.entryType}, and ${entry.era}.`}
    >
      <section className="artifact-page">
        <div className="artifact-page__primary">
          <article className="artifact-card">
            <div className="artifact-card__header">
              <p className="kicker">Archive record</p>
              <h2>{entry.displayName}</h2>
              <p className="artifact-card__work">
                {entry.titleOfWork} · {entry.actorOrPerson}
              </p>
            </div>
            <EntryMeta entry={entry} />
            <div className="artifact-card__sections">
              <section className="artifact-section">
                <h3>Synopsis</h3>
                <p>{entry.synopsis}</p>
              </section>
              <section className="artifact-section">
                <h3>Editorial blurb</h3>
                <p>{entry.editorialBlurb}</p>
              </section>
              <section className="artifact-section artifact-section--accent">
                <h3>Why this Steve matters</h3>
                <p>{entry.whyItMatters}</p>
              </section>
            </div>
          </article>
        </div>

        <aside className="artifact-page__secondary">
          <section className="artifact-sidecard">
            <p className="kicker">Filed under</p>
            <h3>Steve energy</h3>
            <p className="artifact-sidecard__energy">{entry.steveEnergy}</p>
            <TagList items={entry.tags} label={`${entry.displayName} tags`} tone="accent" />
          </section>

          <section className="artifact-sidecard">
            <p className="kicker">Taxonomy</p>
            <h3>Archetypes and tones</h3>
            <TagList items={entry.archetypes} label={`${entry.displayName} archetypes`} tone="soft" />
            <TagList items={entry.tones} label={`${entry.displayName} tones`} tone="soft" />
          </section>

          {entry.sourceNotes.length ? (
            <section className="artifact-sidecard">
              <p className="kicker">Archive note</p>
              <h3>Source context</h3>
              <ul className="note-list">
                {entry.sourceNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </section>

      <div className="split">
        <RelatedEntries entries={relatedEntries} />

        <section className="stack">
          <SectionHeader
            eyebrow="Editorial pathways"
            title="Collections"
            description={`Shelves this entry already belongs to. ${relatedCollections.length} collection${relatedCollections.length === 1 ? "" : "s"} visible.`}
          />
          {relatedCollections.length ? (
            <div className="grid">
              {relatedCollections.map((collection) => (
                <CollectionCard collection={collection} key={collection.id} variant="compact" />
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="Not shelved yet"
              title="No collection appearances yet"
              description="This entry is live in the archive before it has been fully folded into the editorial shelf system."
            />
          )}
        </section>
      </div>
    </SiteShell>
  );
}
