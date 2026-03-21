import type { Collection, SteveEntry } from "@/src/lib/schema";

import type { SearchDocument } from "@/src/lib/search/search-types";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function buildSearchIndex(entries: SteveEntry[], collections: Collection[]): SearchDocument[] {
  const entryDocs: SearchDocument[] = entries.map((entry) => {
    const keywords = unique([
      entry.displayName,
      entry.canonicalName,
      entry.actorOrPerson,
      entry.titleOfWork,
      entry.summary,
      ...entry.searchAliases,
      ...entry.tags,
      ...entry.archetypes,
      ...entry.tones
    ]);

    return {
      id: entry.id,
      kind: "entry",
      slug: entry.slug,
      title: entry.displayName,
      subtitle: `${entry.titleOfWork} (${entry.yearStart})`,
      description: entry.summary,
      medium: entry.medium,
      nameVariant: entry.nameVariant,
      tags: entry.tags,
      searchText: normalizeText(
        [
          entry.displayName,
          entry.canonicalName,
          entry.medium,
          entry.entryType,
          entry.nameVariant,
          entry.era,
          entry.actorOrPerson,
          entry.titleOfWork,
          entry.summary,
          entry.synopsis,
          entry.editorialBlurb,
          entry.whyItMatters,
          entry.appearanceContext ?? "",
          entry.notesOnUncertainty ?? "",
          ...keywords
        ].join(" ")
      ),
      keywords,
      href: `/steves/${entry.slug}`
    };
  });

  const collectionDocs: SearchDocument[] = collections.map((collection) => {
    const keywords = unique([collection.title, collection.dek, collection.thesis, ...collection.tags]);

    return {
      id: collection.id,
      kind: "collection",
      slug: collection.slug,
      title: collection.title,
      subtitle: collection.dek,
      description: collection.thesis,
      tags: collection.tags,
      searchText: normalizeText([collection.title, collection.dek, collection.thesis, ...keywords].join(" ")),
      keywords,
      href: `/collections/${collection.slug}`
    };
  });

  return [...entryDocs, ...collectionDocs];
}

export function normalizeSearchQuery(value: string) {
  return normalizeText(value);
}
