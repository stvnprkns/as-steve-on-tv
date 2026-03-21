import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link className="site-brand" href="/">
          <span className="site-brand__name">As Steve on TV</span>
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <Link href="/">archive</Link>
          <Link href="/method">method</Link>
          <Link href="/submit">submit</Link>
        </nav>
      </div>
    </header>
  );
}
