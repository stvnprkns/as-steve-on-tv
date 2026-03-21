import { EntryCard } from "@/src/components/cards/entry-card";
import type { SteveEntry } from "@/src/lib/schema";

export function SteveCard({ entry }: { entry: SteveEntry }) {
  return <EntryCard entry={entry} variant="standard" />;
}
