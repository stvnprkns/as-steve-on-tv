import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__inner">
        <p>Editorial archive. Community-fed. Narrow on purpose.</p>
        <nav className="site-footer__nav" aria-label="Footer">
          <Link href="/">Archive</Link>
          <Link href="/method">Method</Link>
          <Link href="/submit">Report a Steve</Link>
        </nav>
      </div>
    </footer>
  );
}
