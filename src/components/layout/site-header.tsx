import Link from "next/link";

import { SearchBar } from "@/src/components/search/search-bar";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <div className="site-header__top">
          <Link className="site-brand" href="/">
            <span className="site-brand__eyebrow">Index of Record</span>
            <span className="site-brand__name">As Steve on TV</span>
          </Link>
          <nav className="site-nav" aria-label="Primary">
            <Link href="/browse">Browse</Link>
            <Link href="/search">Search</Link>
            <Link href="/submit">Submit a Steve</Link>
          </nav>
        </div>
        <div className="site-header__search">
          <p className="site-header__line">TV. Movies. Commercials. Nothing broader than that.</p>
          <SearchBar
            action="/search"
            buttonLabel="Find"
            placeholder="Search the archive..."
            variant="compact"
          />
        </div>
      </div>
    </header>
  );
}
