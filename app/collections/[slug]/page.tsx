import { notFound } from "next/navigation";

import { RecordRow } from "@/src/components/archive/record-row";
import { getAllCollections, getAllEntries, getCollectionBySlug } from "@/src/lib/content";
import { getPublishedEntries } from "@/src/lib/content/selectors";
import { buildMetadata } from "@/src/lib/seo/metadata";

export async function generateStaticParams() {
  const collections = await getAllCollections();
  return collections.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    return buildMetadata({
      title: "Collection not found | As Steve on TV"
    });
  }

  return buildMetadata({
    title: `${collection.title} | As Steve on TV`,
    description: collection.seoDescription
  });
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [collection, allEntries] = await Promise.all([getCollectionBySlug(slug), getAllEntries()]);

  if (!collection) {
    notFound();
  }

  const publishedEntries = getPublishedEntries(allEntries);
  const entries = publishedEntries.filter((entry) => collection.entryIds.includes(entry.id));

  return (
    <div className="document-page">
      <section className="document-card">
        <p className="section-label">{collection.collectionType.replaceAll("_", " ")}</p>
        <h1>{collection.title}</h1>
        <p>{collection.dek}</p>
        <p>{collection.thesis}</p>
        {entries.length !== collection.entryIds.length ? (
          <p className="detail-note">
            Some items in this collection are still under editorial review and are not yet visible on the public site.
          </p>
        ) : null}
      </section>

      <section className="document-card">
        <div className="document-card__header">
          <p className="section-label">Collection entries</p>
          <h2>{entries.length} records in view</h2>
        </div>
        <div className="stack">
          {entries.map((entry) => (
            <RecordRow compact entry={entry} key={entry.id} />
          ))}
        </div>
      </section>
    </div>
  );
}
