import Link from "next/link";

import {
  formatMediumLabel,
  formatVariantLabel,
  formatYearLabel,
  getRecordKindLabel
} from "@/src/lib/archive";
import type { SteveEntry } from "@/src/lib/schema";

export function RecordRow({
  entry,
  compact = false
}: {
  entry: SteveEntry;
  compact?: boolean;
}) {
  const quietMeta = [formatMediumLabel(entry.medium), formatYearLabel(entry), formatVariantLabel(entry.nameVariant)];

  if (!compact) {
    quietMeta.push(getRecordKindLabel(entry));
  }

  if (entry.verificationStatus !== "verified") {
    quietMeta.push(entry.verificationStatus.replaceAll("_", " "));
  }

  return (
    <article className={`record-row${compact ? " record-row--compact" : ""}`}>
      <div className="record-row__media" aria-hidden="true">
        {entry.image ? (
          <img alt={entry.image.alt} className="record-row__image" src={entry.image.src} />
        ) : (
          <div className="record-row__placeholder">
            <span className="record-row__placeholder-year">{formatYearLabel(entry)}</span>
          </div>
        )}
      </div>

      <div className="record-row__body">
        <h2 className="record-row__title">
          <Link href={`/steves/${entry.slug}`}>{entry.displayName}</Link>
        </h2>
        <p className="record-row__context">
          {entry.titleOfWork}
          {!compact && entry.actorOrPerson !== entry.displayName ? ` · ${entry.actorOrPerson}` : null}
        </p>

        <p className="record-row__summary">{entry.summary}</p>
        <p className="record-row__quiet-meta">{quietMeta.join(" / ")}</p>
        {!compact && entry.verificationStatus === "disputed" && entry.notesOnUncertainty ? (
          <p className="record-row__note">{entry.notesOnUncertainty}</p>
        ) : null}
      </div>
    </article>
  );
}
