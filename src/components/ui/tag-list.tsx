export function TagList({
  items,
  label,
  tone = "default"
}: {
  items: string[];
  label: string;
  tone?: "default" | "accent" | "soft";
}) {
  if (!items.length) {
    return null;
  }

  return (
    <ul aria-label={label} className={`tag-list tag-list--${tone}`}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

