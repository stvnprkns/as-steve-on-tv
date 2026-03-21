import { EntryCard } from "@/src/components/cards/entry-card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { SectionHeader } from "@/src/components/ui/section-header";
import type { SteveEntry } from "@/src/lib/schema";

export function RelatedEntries({
  entries
}: {
  entries: SteveEntry[];
}) {
  return (
    <section className="stack">
      <SectionHeader
        eyebrow="Continue in the archive"
        title="Related Steves"
        description="Explicitly linked entries that keep the rabbit hole moving."
      />
      {entries.length ? (
        <div className="grid grid--two">
          {entries.map((entry) => (
            <EntryCard entry={entry} key={entry.id} variant="compact" />
          ))}
        </div>
      ) : (
        <EmptyState
          eyebrow="No adjacent filing"
          title="This card is standing alone for now."
          description="The archive is young. More explicit relations will arrive as the cabinet deepens."
        />
      )}
    </section>
  );
}

