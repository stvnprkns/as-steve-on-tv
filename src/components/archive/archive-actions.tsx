import Link from "next/link";

import type { SteveEntry } from "@/src/lib/schema";

const actionLabels = [
  { type: "confirm", label: "Confirm sighting" },
  { type: "dispute", label: "Dispute" },
  { type: "evidence", label: "Add evidence" },
  { type: "correction", label: "Suggest correction" }
] as const;

export function ArchiveActions({ entry }: { entry: SteveEntry }) {
  return (
    <div className="archive-actions" aria-label={`Archive actions for ${entry.displayName}`}>
      {actionLabels.map((action) => (
        <Link
          className="archive-actions__link"
          href={`/submit?action=${action.type}&entry=${entry.slug}`}
          key={`${entry.id}-${action.type}`}
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}
