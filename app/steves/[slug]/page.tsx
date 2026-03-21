import Link from "next/link";
import { notFound } from "next/navigation";

import { ArchiveActions } from "@/src/components/archive/archive-actions";
import { RecordRow } from "@/src/components/archive/record-row";
import { VerificationBadge } from "@/src/components/archive/verification-badge";
import {
  formatMediumLabel,
  formatVariantLabel,
  formatYearLabel,
  getRecordKindLabel,
  isFixtureUrl
} from "@/src/lib/archive";
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
    <div className="entry-page">
      <header className="entry-page__header">
        <div className="entry-page__topline">
          <VerificationBadge status={entry.verificationStatus} />
          <span>{formatMediumLabel(entry.medium)}</span>
          <span>{formatYearLabel(entry)}</span>
          <span>{formatVariantLabel(entry.nameVariant)}</span>
        </div>
        <h1>{entry.displayName}</h1>
        <p className="entry-page__subhead">
          {entry.titleOfWork} · {entry.actorOrPerson}
        </p>
        <p className="entry-page__summary">{entry.summary}</p>
      </header>

      <div className="entry-page__layout">
        <section className="entry-page__main">
          {entry.image ? (
            <figure className="entry-figure">
              <img alt={entry.image.alt} src={entry.image.src} />
              {entry.image.credit ? <figcaption>{entry.image.credit}</figcaption> : null}
            </figure>
          ) : null}

          <section className="document-card">
            <p className="section-label">Editorial note</p>
            <h2>Why this record stays in the archive</h2>
            <p>{entry.editorialBlurb}</p>
          </section>

          <section className="document-card">
            <p className="section-label">Why it matters</p>
            <p>{entry.whyItMatters}</p>
          </section>

          <section className="document-card">
            <p className="section-label">Appearance context</p>
            <p>{entry.appearanceContext ?? entry.synopsis}</p>
            <p>{entry.synopsis}</p>
          </section>

          {relatedEntries.length ? (
            <section className="document-card">
              <div className="document-card__header">
                <p className="section-label">Related Steves</p>
                <h2>Adjacent records</h2>
              </div>
              <div className="stack">
                {relatedEntries.map((relatedEntry) => (
                  <RecordRow compact entry={relatedEntry} key={relatedEntry.id} />
                ))}
              </div>
            </section>
          ) : null}
        </section>

        <aside className="entry-page__side">
          <section className="document-card">
            <p className="section-label">Record ledger</p>
            <dl className="entry-ledger">
              <div>
                <dt>Filed as</dt>
                <dd>{getRecordKindLabel(entry)}</dd>
              </div>
              <div>
                <dt>Era</dt>
                <dd>{entry.era}</dd>
              </div>
              <div>
                <dt>Franchise</dt>
                <dd>{entry.franchise ?? "Standalone"}</dd>
              </div>
              <div>
                <dt>Aliases</dt>
                <dd>{entry.searchAliases.length ? entry.searchAliases.join(", ") : "None filed"}</dd>
              </div>
              <div>
                <dt>Archetypes</dt>
                <dd>{entry.archetypes.join(", ")}</dd>
              </div>
              <div>
                <dt>Tones</dt>
                <dd>{entry.tones.join(", ")}</dd>
              </div>
            </dl>
          </section>

          <section className="document-card">
            <p className="section-label">Verification</p>
            <h2>{entry.verificationStatus === "verified" ? "Verified Steve sighting." : entry.summary}</h2>
            <p>
              {entry.notesOnUncertainty
                ? entry.notesOnUncertainty
                : "This record currently sits in the settled portion of the archive."}
            </p>
            <dl className="entry-signals">
              <div>
                <dt>Confirmations</dt>
                <dd>{entry.communitySignals.confirmations}</dd>
              </div>
              <div>
                <dt>Disputes</dt>
                <dd>{entry.communitySignals.disputes}</dd>
              </div>
              <div>
                <dt>Evidence links</dt>
                <dd>{entry.communitySignals.evidenceLinks}</dd>
              </div>
            </dl>
            {entry.evidenceLinks.length ? (
              <ul className="evidence-list">
                {entry.evidenceLinks.map((source) => (
                  <li key={source.url}>
                    {isFixtureUrl(source.url) ? (
                      <span>{source.label} (fixture source)</span>
                    ) : (
                      <a href={source.url}>{source.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="document-card">
            <p className="section-label">Archive actions</p>
            <ArchiveActions entry={entry} />
          </section>

          {relatedCollections.length ? (
            <section className="document-card">
              <p className="section-label">Collections</p>
              <ul className="link-list">
                {relatedCollections.map((collection) => (
                  <li key={collection.id}>
                    <Link href={`/collections/${collection.slug}`}>{collection.title}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="document-card">
            <p className="section-label">Continue filing</p>
            <ul className="link-list">
              <li>
                <Link href={`/?medium=${entry.medium}`}>More {formatMediumLabel(entry.medium)} records</Link>
              </li>
              <li>
                <Link href={`/?decade=${entry.era}`}>More {entry.era} sightings</Link>
              </li>
              <li>
                <Link href={`/?variant=${entry.nameVariant}`}>More {formatVariantLabel(entry.nameVariant)} records</Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
