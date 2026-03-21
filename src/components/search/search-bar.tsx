export function SearchBar({
  defaultValue = "",
  action = "/",
  hiddenFields = {},
  placeholder = "Search for a Steve, title, performer, or collection...",
  buttonLabel = "Search",
  variant = "default"
}: {
  defaultValue?: string;
  action?: string;
  hiddenFields?: Record<string, string>;
  placeholder?: string;
  buttonLabel?: string;
  variant?: "default" | "compact";
}) {
  return (
    <form action={action} className={`search-bar search-bar--${variant}`}>
      {Object.entries(hiddenFields).map(([key, value]) => (
        <input key={`${key}-${value}`} name={key} type="hidden" value={value} />
      ))}
      <input
        aria-label="Search the archive"
        defaultValue={defaultValue}
        name="q"
        placeholder={placeholder}
        type="search"
      />
      <button type="submit">{buttonLabel}</button>
    </form>
  );
}
