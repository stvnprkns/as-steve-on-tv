import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div className="section-header__copy">
        {eyebrow ? <p className="section-header__eyebrow">{eyebrow}</p> : null}
        <h2 className="section-header__title">{title}</h2>
        {description ? <p className="section-header__description">{description}</p> : null}
      </div>
      {action ? <div className="section-header__action">{action}</div> : null}
    </div>
  );
}

