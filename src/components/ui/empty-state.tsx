import Link from "next/link";

export function EmptyState({
  eyebrow,
  title,
  description,
  links = []
}: {
  eyebrow?: string;
  title: string;
  description: string;
  links?: Array<{ href: string; label: string }>;
}) {
  return (
    <section className="empty-state">
      {eyebrow ? <p className="empty-state__eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      <p>{description}</p>
      {links.length ? (
        <div className="empty-state__links">
          {links.map((link) => (
            <Link className="text-link" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

