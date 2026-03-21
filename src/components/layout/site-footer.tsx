import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__inner">
        <p>an editorial archive of Steve on screen</p>
        <nav className="site-footer__nav" aria-label="Footer">
          <Link href="/">archive</Link>
          <Link href="/method">method</Link>
          <Link href="/submit">report</Link>
        </nav>
      </div>
    </footer>
  );
}
