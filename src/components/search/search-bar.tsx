export function SearchBar({
  defaultValue = "",
  action = "/search",
  placeholder = "Search for a Steve, title, performer, or collection...",
  buttonLabel = "Search",
  variant = "default"
}: {
  defaultValue?: string;
  action?: string;
  placeholder?: string;
  buttonLabel?: string;
  variant?: "default" | "compact";
}) {
  return (
    <form action={action} className={`search-bar search-bar--${variant}`}>
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

