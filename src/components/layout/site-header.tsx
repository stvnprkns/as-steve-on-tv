import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link className="site-brand" href="/">
          <span className="site-brand__name">As Steve on TV</span>
          <span className="site-brand__eyebrow">Archive</span>
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <Link href="/">Archive</Link>
          <Link href="/method">Method</Link>
          <Link href="/submit">Submit</Link>
        </nav>
      </div>
    </header>
  );
}
