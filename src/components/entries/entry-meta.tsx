import type { SteveEntry } from "@/src/lib/schema";

export function EntryMeta({
  entry,
  variant = "default"
}: {
  entry: SteveEntry;
  variant?: "default" | "compact";
}) {
  const items = [
    { label: "Medium", value: entry.medium },
    { label: "Filed as", value: entry.nameVariant },
    { label: "Type", value: entry.entryType },
    { label: "Work", value: entry.titleOfWork },
    { label: "Performer", value: entry.actorOrPerson },
    {
      label: "Years",
      value: entry.yearEnd ? `${entry.yearStart}-${entry.yearEnd}` : `${entry.yearStart}`
    },
    { label: "Era", value: entry.era }
  ];

  return (
    <dl className={`entry-meta entry-meta--${variant}`}>
      {items.map((item) => (
        <div className="entry-meta__item" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

