import Link from "next/link";

import type { SearchDocument } from "@/src/lib/search/search-types";

export function SearchResultList({
  query,
  results
}: {
  query: string;
  results: SearchDocument[];
}) {
  return (
    <section className="stack">
      <div className="section-heading">
        <h2>{query ? `Results for "${query}"` : "Search index preview"}</h2>
        <p>{results.length} result{results.length === 1 ? "" : "s"}</p>
      </div>
      <div className="list-stack">
        {results.map((result) => (
          <article className="list-item" key={`${result.kind}-${result.id}`}>
            <div className="list-item__meta">
              <span>{result.kind}</span>
              {result.medium ? <span>{result.medium}</span> : null}
              {result.nameVariant ? <span>{result.nameVariant}</span> : null}
            </div>
            <h3>
              <Link href={result.href}>{result.title}</Link>
            </h3>
            <p>{result.subtitle}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

