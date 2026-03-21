import { notFound } from "next/navigation";

import { SteveCard } from "@/src/components/cards/steve-card";
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
    <div className="stack">
      <section className="detail-panel">
        <p className="kicker">{collection.collectionType.replaceAll("_", " ")}</p>
        <h1>{collection.title}</h1>
        <p>{collection.dek}</p>
        <p>{collection.thesis}</p>
        {entries.length !== collection.entryIds.length ? (
          <p className="detail-note">
            Some items in this collection are still under editorial review and are not yet visible on the public site.
          </p>
        ) : null}
      </section>
      <section className="stack">
        <div className="section-heading">
          <h2>Collection entries</h2>
          <p>{entries.length} entries in this editorial object.</p>
        </div>
        <div className="grid grid--three">
          {entries.map((entry) => (
            <SteveCard entry={entry} key={entry.id} />
          ))}
        </div>
      </section>
    </div>
  );
}
