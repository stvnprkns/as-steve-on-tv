import { buildSearchIndex } from "@/src/lib/search/build-search-index";
import { searchEntries } from "@/src/lib/search/search-entries";
import type { SearchDocument } from "@/src/lib/search/search-types";
import type {
  Collection,
  EraTag,
  Medium,
  NameVariant,
  PublicRecordStatus,
  SteveEntry,
  SubmissionType
} from "@/src/lib/schema";

export const archiveSorts = ["canon", "newest", "needs-verification"] as const;

export type ArchiveSort = (typeof archiveSorts)[number];

export type ArchiveQuery = {
  q: string;
  sort: ArchiveSort;
  medium: Medium | null;
  variant: NameVariant | null;
  decade: EraTag | null;
  status: PublicRecordStatus | null;
};

const canonEntryIds = [
  "steve-urkel-family-matters",
  "steve-burns-blues-clues",
  "steve-harrington-stranger-things",
  "steve-zissou-the-life-aquatic",
  "steve-rogers-captain-america-the-first-avenger",
  "steven-hyde-that-70s-show",
  "steve-holt-arrested-development",
  "stevie-budd-schitts-creek",
  "steve-stifler-american-pie",
  "steven-seagal-lightning-bolt-commercial",
  "stevie-nicks-fajita-roundup-commercial"
] as const;

const archiveActionTypes: SubmissionType[] = ["report", "confirm", "dispute", "evidence", "correction"];

export function parseArchiveQuery(
  params: Record<string, string | string[] | undefined>,
  {
    mediums,
    nameVariants,
    eraTags,
    publicRecordStatuses
  }: {
    mediums: readonly Medium[];
    nameVariants: readonly NameVariant[];
    eraTags: readonly EraTag[];
    publicRecordStatuses: readonly PublicRecordStatus[];
  }
): ArchiveQuery {
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

  const q = pick(params.q);
  const sortCandidate = pick(params.sort) as ArchiveSort;
  const mediumCandidate = pick(params.medium) as Medium;
  const variantCandidate = pick(params.variant) as NameVariant;
  const decadeCandidate = pick(params.decade) as EraTag;
  const statusCandidate = pick(params.status) as PublicRecordStatus;

  return {
    q,
    sort: archiveSorts.includes(sortCandidate) ? sortCandidate : "canon",
    medium: mediums.includes(mediumCandidate) ? mediumCandidate : null,
    variant: nameVariants.includes(variantCandidate) ? variantCandidate : null,
    decade: eraTags.includes(decadeCandidate) ? decadeCandidate : null,
    status: publicRecordStatuses.includes(statusCandidate) ? statusCandidate : null
  };
}

export function isArchiveActionType(value: string | null | undefined): value is SubmissionType {
  return Boolean(value && archiveActionTypes.includes(value as SubmissionType));
}

export function getPublishedEntries(entries: SteveEntry[]) {
  return entries.filter((entry) => entry.status === "published");
}

export function formatYearLabel(entry: SteveEntry) {
  return entry.yearEnd ? `${entry.yearStart}-${entry.yearEnd}` : `${entry.yearStart}`;
}

export function formatMediumLabel(medium: Medium) {
  return medium === "tv" ? "TV" : medium === "film" ? "Film" : "Commercial";
}

export function formatVariantLabel(variant: NameVariant) {
  return variant.charAt(0).toUpperCase() + variant.slice(1);
}

export function formatVerificationLabel(status: PublicRecordStatus) {
  switch (status) {
    case "verified":
      return "Verified";
    case "community_confirmed":
      return "Community-confirmed";
    case "needs_verification":
      return "Needs verification";
    case "disputed":
      return "Disputed";
    case "corrected":
      return "Corrected";
    default:
      return status;
  }
}

export function isFixtureUrl(url: string) {
  return url.includes("example.com");
}

export function getRecordKindLabel(entry: SteveEntry) {
  switch (entry.entryType) {
    case "character":
      return "Fictional";
    case "person":
      return "Real";
    case "persona":
      return "Persona";
    default:
      return entry.entryType;
  }
}

export function getArchiveCounts(entries: SteveEntry[]) {
  const publishedEntries = getPublishedEntries(entries);

  return {
    total: publishedEntries.length,
    verified: publishedEntries.filter((entry) => entry.verificationStatus === "verified").length,
    unresolved: publishedEntries.filter((entry) =>
      ["needs_verification", "disputed"].includes(entry.verificationStatus)
    ).length,
    latestFiledAt:
      [...publishedEntries].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.createdAt ?? null
  };
}

function getCanonOrder(entries: SteveEntry[]) {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const curated = canonEntryIds
    .map((id) => entryMap.get(id))
    .filter((entry): entry is SteveEntry => Boolean(entry));
  const curatedIds = new Set(curated.map((entry) => entry.id));
  const remainder = entries
    .filter((entry) => !curatedIds.has(entry.id))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  return [...curated, ...remainder];
}

function getNeedsVerificationWeight(status: PublicRecordStatus) {
  switch (status) {
    case "needs_verification":
      return 0;
    case "disputed":
      return 1;
    case "community_confirmed":
      return 2;
    case "corrected":
      return 3;
    case "verified":
    default:
      return 4;
  }
}

export function getArchiveEntries(
  entries: SteveEntry[],
  collections: Collection[],
  query: ArchiveQuery,
  searchDocuments?: SearchDocument[]
) {
  const publishedEntries = getPublishedEntries(entries);
  const matchedRank = new Map<string, number>();

  if (query.q) {
    const results = searchEntries(query.q, searchDocuments ?? buildSearchIndex(publishedEntries, collections));
    results.entries.forEach((result, index) => matchedRank.set(result.id, index));
  }

  const filtered = publishedEntries.filter((entry) => {
    if (query.q && !matchedRank.has(entry.id)) {
      return false;
    }

    if (query.medium && entry.medium !== query.medium) {
      return false;
    }

    if (query.variant && entry.nameVariant !== query.variant) {
      return false;
    }

    if (query.decade && entry.era !== query.decade) {
      return false;
    }

    if (query.status && entry.verificationStatus !== query.status) {
      return false;
    }

    return true;
  });

  if (query.q) {
    return [...filtered].sort((left, right) => {
      if (query.sort === "newest") {
        return right.createdAt.localeCompare(left.createdAt);
      }

      if (query.sort === "needs-verification") {
        const weightDelta =
          getNeedsVerificationWeight(left.verificationStatus) - getNeedsVerificationWeight(right.verificationStatus);

        if (weightDelta !== 0) {
          return weightDelta;
        }
      }

      return (matchedRank.get(left.id) ?? 999) - (matchedRank.get(right.id) ?? 999);
    });
  }

  if (query.sort === "newest") {
    return [...filtered].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  if (query.sort === "needs-verification") {
    return [...filtered].sort((left, right) => {
      const weightDelta =
        getNeedsVerificationWeight(left.verificationStatus) - getNeedsVerificationWeight(right.verificationStatus);

      if (weightDelta !== 0) {
        return weightDelta;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }

  const canonOrder = getCanonOrder(filtered);
  return canonOrder;
}

export function getInlineCollections(entries: SteveEntry[], collections: Collection[], limit = 2) {
  const visibleEntryIds = new Set(entries.map((entry) => entry.id));

  return collections
    .filter((collection) => collection.status === "published")
    .map((collection) => ({
      collection,
      visibleCount: collection.entryIds.filter((entryId) => visibleEntryIds.has(entryId)).length
    }))
    .filter((item) => item.visibleCount > 0)
    .sort((left, right) => {
      if (right.visibleCount !== left.visibleCount) {
        return right.visibleCount - left.visibleCount;
      }

      return left.collection.title.localeCompare(right.collection.title);
    })
    .slice(0, limit)
    .map((item) => item.collection);
}

export function hasActiveArchiveFilters(query: ArchiveQuery) {
  return Boolean(query.q || query.medium || query.variant || query.decade || query.status || query.sort !== "canon");
}

export function buildArchiveHref(query: ArchiveQuery, patch: Partial<ArchiveQuery>) {
  const nextQuery: ArchiveQuery = {
    ...query,
    ...patch
  };
  const params = new URLSearchParams();

  if (nextQuery.q) {
    params.set("q", nextQuery.q);
  }

  if (nextQuery.sort !== "canon") {
    params.set("sort", nextQuery.sort);
  }

  if (nextQuery.medium) {
    params.set("medium", nextQuery.medium);
  }

  if (nextQuery.variant) {
    params.set("variant", nextQuery.variant);
  }

  if (nextQuery.decade) {
    params.set("decade", nextQuery.decade);
  }

  if (nextQuery.status) {
    params.set("status", nextQuery.status);
  }

  const queryString = params.toString();
  return queryString ? `/?${queryString}` : "/";
}
