import Link from "next/link";

import { TagList } from "@/src/components/ui/tag-list";
import type { Collection } from "@/src/lib/schema";

export function CollectionCard({
  collection,
  variant = "standard"
}: {
  collection: Collection;
  variant?: "standard" | "compact";
}) {
  const compact = variant === "compact";
  const body = compact && collection.thesis.length > 180 ? `${collection.thesis.slice(0, 180).trimEnd()}...` : collection.thesis;

  return (
    <article className={`collection-card collection-card--${variant}`}>
      <div className="collection-card__meta">
        <span>{collection.collectionType.replaceAll("_", " ")}</span>
        <span>{collection.entryIds.length} entries</span>
      </div>
      <h3 className="collection-card__title">
        <Link href={`/collections/${collection.slug}`}>{collection.title}</Link>
      </h3>
      <p className="collection-card__dek">{collection.dek}</p>
      <p className="collection-card__body">{body}</p>
      <TagList items={collection.tags.slice(0, compact ? 2 : 4)} label={`${collection.title} tags`} tone="soft" />
    </article>
  );
}
