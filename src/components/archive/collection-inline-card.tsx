import Link from "next/link";

import type { Collection } from "@/src/lib/schema";

export function CollectionInlineCard({ collection }: { collection: Collection }) {
  return (
    <aside className="collection-inline-card">
      <p className="collection-inline-card__eyebrow">Editorial insert</p>
      <h2>
        <Link href={`/collections/${collection.slug}`}>{collection.title}</Link>
      </h2>
      <p>{collection.dek}</p>
      <p className="collection-inline-card__thesis">{collection.thesis}</p>
    </aside>
  );
}
