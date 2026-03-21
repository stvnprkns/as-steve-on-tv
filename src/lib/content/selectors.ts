import type { Collection, SteveEntry, TaxonomyData } from "@/src/lib/schema";

const spotlightEntryId = "steve-urkel-family-matters";
const featuredEntryIds = [
  "steve-burns-blues-clues",
  "steve-harrington-stranger-things",
  "stevie-budd-schitts-creek",
  "steve-zissou-the-life-aquatic"
] as const;
const homepageCollectionIds = [
  "patron-saints-of-sitcom-steve",
  "nostalgia-core-steves",
  "movie-steves-with-aura"
] as const;

export type BrowseCue = {
  label: string;
  count: number;
  href: string;
};

export type BrowseCueGroup = {
  title: string;
  items: BrowseCue[];
};

function encodeSearchHref(query: string) {
  return `/search?q=${encodeURIComponent(query)}`;
}

function sortByCountAndLabel(entries: Array<{ label: string; count: number; href: string }>) {
  return [...entries].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.label.localeCompare(right.label);
  });
}

export function getPublishedEntries(entries: SteveEntry[]) {
  return entries.filter((entry) => entry.status === "published");
}

export function getSpotlightEntry(entries: SteveEntry[]) {
  const publishedEntries = getPublishedEntries(entries);
  return publishedEntries.find((entry) => entry.id === spotlightEntryId) ?? publishedEntries[0] ?? null;
}

export function getFeaturedEntries(entries: SteveEntry[], limit = 4) {
  const publishedEntries = getPublishedEntries(entries);
  const curated = featuredEntryIds
    .map((id) => publishedEntries.find((entry) => entry.id === id))
    .filter((entry): entry is SteveEntry => Boolean(entry));

  if (curated.length >= limit) {
    return curated.slice(0, limit);
  }

  const curatedIds = new Set(curated.map((entry) => entry.id));
  const fallback = publishedEntries.filter((entry) => !curatedIds.has(entry.id));

  return [...curated, ...fallback].slice(0, limit);
}

export function getRecentEntries(entries: SteveEntry[], limit = 4) {
  return [...getPublishedEntries(entries)]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export function getHomepageCollections(collections: Collection[], limit = 3) {
  const publishedCollections = collections.filter((collection) => collection.status === "published");
  const curated = homepageCollectionIds
    .map((id) => publishedCollections.find((collection) => collection.id === id))
    .filter((collection): collection is Collection => Boolean(collection));

  if (curated.length >= limit) {
    return curated.slice(0, limit);
  }

  const curatedIds = new Set(curated.map((collection) => collection.id));
  const fallback = publishedCollections.filter((collection) => !curatedIds.has(collection.id));

  return [...curated, ...fallback].slice(0, limit);
}

export function getRelatedEntries(entry: SteveEntry, entries: SteveEntry[], limit = 4) {
  const publishedEntries = getPublishedEntries(entries);
  const entryMap = new Map(publishedEntries.map((candidate) => [candidate.id, candidate]));

  return entry.relatedEntryIds
    .map((relatedId) => entryMap.get(relatedId))
    .filter((candidate): candidate is SteveEntry => Boolean(candidate))
    .slice(0, limit);
}

export function getBrowseCues(entries: SteveEntry[], taxonomy: TaxonomyData): BrowseCueGroup[] {
  const publishedEntries = getPublishedEntries(entries);

  const mediumCounts = sortByCountAndLabel(
    taxonomy.mediums
      .map((medium) => ({
        label: medium.toUpperCase(),
        count: publishedEntries.filter((entry) => entry.medium === medium).length,
        href: encodeSearchHref(medium)
      }))
      .filter((item) => item.count > 0)
  );

  const variantCounts = sortByCountAndLabel(
    taxonomy.nameVariants
      .map((variant) => ({
        label: variant,
        count: publishedEntries.filter((entry) => entry.nameVariant === variant).length,
        href: encodeSearchHref(variant)
      }))
      .filter((item) => item.count > 0)
  );

  const eraCounts = sortByCountAndLabel(
    taxonomy.eraTags
      .map((era) => ({
        label: era,
        count: publishedEntries.filter((entry) => entry.era === era).length,
        href: encodeSearchHref(era)
      }))
      .filter((item) => item.count > 0)
  ).slice(0, 4);

  return [
    { title: "By medium", items: mediumCounts },
    { title: "By variant", items: variantCounts },
    { title: "By era", items: eraCounts }
  ];
}

