import Link from "next/link";

import { ArchiveActions } from "@/src/components/archive/archive-actions";
import { VerificationBadge } from "@/src/components/archive/verification-badge";
import {
  formatMediumLabel,
  formatVariantLabel,
  formatYearLabel,
  getRecordKindLabel
} from "@/src/lib/archive";
import type { SteveEntry } from "@/src/lib/schema";

export function RecordRow({
  entry,
  showActions = true,
  compact = false
}: {
  entry: SteveEntry;
  showActions?: boolean;
  compact?: boolean;
}) {
  return (
    <article className={`record-row${compact ? " record-row--compact" : ""}`}>
      <div className="record-row__media" aria-hidden="true">
        {entry.image ? (
          <img alt={entry.image.alt} className="record-row__image" src={entry.image.src} />
        ) : (
          <div className="record-row__placeholder">
            <span>{formatVariantLabel(entry.nameVariant)}</span>
            <span>{formatYearLabel(entry)}</span>
          </div>
        )}
      </div>

      <div className="record-row__body">
        <div className="record-row__topline">
          <VerificationBadge status={entry.verificationStatus} />
          <span>{formatMediumLabel(entry.medium)}</span>
          <span>{formatYearLabel(entry)}</span>
          <span>{formatVariantLabel(entry.nameVariant)}</span>
        </div>

        <h2 className="record-row__title">
          <Link href={`/steves/${entry.slug}`}>{entry.displayName}</Link>
          <span className="record-row__context">
            {entry.titleOfWork} · {entry.actorOrPerson}
          </span>
        </h2>

        <p className="record-row__summary">{entry.summary}</p>

        <dl className="record-row__meta">
          <div>
            <dt>Filed as</dt>
            <dd>{getRecordKindLabel(entry)}</dd>
          </div>
          <div>
            <dt>Era</dt>
            <dd>{entry.era}</dd>
          </div>
          <div>
            <dt>Performer</dt>
            <dd>{entry.actorOrPerson}</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>{entry.communitySignals.evidenceLinks}</dd>
          </div>
        </dl>

        {!compact ? (
          <p className="record-row__notes">
            {entry.notesOnUncertainty
              ? entry.notesOnUncertainty
              : `${entry.communitySignals.confirmations} confirmations, ${entry.communitySignals.disputes} disputes, ${entry.communitySignals.evidenceLinks} evidence links.`}
          </p>
        ) : null}

        {showActions ? <ArchiveActions entry={entry} /> : null}
      </div>
    </article>
  );
}
