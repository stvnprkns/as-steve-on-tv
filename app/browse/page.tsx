import { CollectionRail } from "@/src/components/collections/collection-rail";
import { SteveCard } from "@/src/components/cards/steve-card";
import { getAllCollections, getAllEntries, getTaxonomy } from "@/src/lib/content";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Browse | As Steve on TV",
  description: "Browse the seeded As Steve on TV archive by medium, variant, and editorial collection."
});

export default async function BrowsePage() {
  const [entries, collections, taxonomy] = await Promise.all([getAllEntries(), getAllCollections(), getTaxonomy()]);
  const publishedEntries = entries.filter((entry) => entry.status === "published");
  const groupedByMedium = taxonomy.mediums.map((medium) => ({
    medium,
    entries: publishedEntries.filter((entry) => entry.medium === medium)
  }));

  return (
    <div className="stack">
      <div className="section-heading">
        <h1>Browse the cabinet</h1>
        <p>Core browse facets are already visible here without turning the product into an admin filter panel.</p>
      </div>

      {groupedByMedium.map((group) => (
        <section className="stack" key={group.medium}>
          <div className="section-heading">
            <h2>{group.medium.toUpperCase()}</h2>
            <p>{group.entries.length} published entries</p>
          </div>
          <div className="grid grid--three">
            {group.entries.map((entry) => (
              <SteveCard entry={entry} key={entry.id} />
            ))}
          </div>
        </section>
      ))}

      <section className="stack">
        <div className="section-heading">
          <h2>Controlled vocab preview</h2>
          <p>The taxonomy is now explicit and machine-readable.</p>
        </div>
        <div className="taxonomy-grid">
          <div className="taxonomy-grid__group">
            <h3>Name variants</h3>
            <ul>{taxonomy.nameVariants.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="taxonomy-grid__group">
            <h3>Era tags</h3>
            <ul>{taxonomy.eraTags.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="taxonomy-grid__group">
            <h3>Archetypes</h3>
            <ul>{taxonomy.archetypeTags.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </section>

      <CollectionRail title="Collections" collections={collections.filter((collection) => collection.status === "published")} />
    </div>
  );
}

