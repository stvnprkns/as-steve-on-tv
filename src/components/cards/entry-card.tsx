import Link from "next/link";

import { EntryMeta } from "@/src/components/entries/entry-meta";
import { TagList } from "@/src/components/ui/tag-list";
import type { SteveEntry } from "@/src/lib/schema";

export function EntryCard({
  entry,
  variant = "standard"
}: {
  entry: SteveEntry;
  variant?: "featured" | "standard" | "compact";
}) {
  const isFeatured = variant === "featured";
  const isCompact = variant === "compact";

  return (
    <article className={`entry-card entry-card--${variant}`}>
      <div className="entry-card__topline">
        <span>{entry.medium}</span>
        <span>{entry.era}</span>
        <span>{entry.nameVariant}</span>
      </div>
      <h3 className="entry-card__title">
        <Link href={`/steves/${entry.slug}`}>{entry.displayName}</Link>
      </h3>
      <p className="entry-card__work">
        {entry.titleOfWork} {entry.yearEnd ? `(${entry.yearStart}-${entry.yearEnd})` : `(${entry.yearStart})`}
      </p>
      {!isCompact ? <EntryMeta entry={entry} variant={isFeatured ? "default" : "compact"} /> : null}
      <p className="entry-card__summary">{isFeatured ? entry.editorialBlurb : entry.synopsis}</p>
      {!isCompact ? (
        <p className="entry-card__matter">
          <strong>Why it matters:</strong> {entry.whyItMatters}
        </p>
      ) : null}
      <TagList
        items={isCompact ? entry.tags.slice(0, 3) : [entry.steveEnergy, ...entry.tags.slice(0, 3)]}
        label={`${entry.displayName} tags`}
        tone={isFeatured ? "accent" : "soft"}
      />
    </article>
  );
}

