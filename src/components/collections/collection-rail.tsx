import { CollectionCard } from "@/src/components/cards/collection-card";
import type { Collection } from "@/src/lib/schema";

export function CollectionRail({
  title,
  collections
}: {
  title: string;
  collections: Collection[];
}) {
  return (
    <section className="stack">
      <div className="section-heading">
        <h2>{title}</h2>
        <p>Authored routes into the archive.</p>
      </div>
      <div className="grid grid--two">
        {collections.map((collection) => (
          <CollectionCard key={collection.id} collection={collection} />
        ))}
      </div>
    </section>
  );
}

