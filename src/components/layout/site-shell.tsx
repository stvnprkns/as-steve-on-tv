import type { ReactNode } from "react";

export function SiteShell({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="page-shell">
      <header className="page-shell__intro">
        {eyebrow ? <p className="page-shell__eyebrow">{eyebrow}</p> : null}
        <h1 className="page-shell__title">{title}</h1>
        {description ? <p className="page-shell__description">{description}</p> : null}
      </header>
      {children}
    </div>
  );
}

