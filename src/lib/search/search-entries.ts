import { normalizeSearchQuery } from "@/src/lib/search/build-search-index";
import type { SearchDocument } from "@/src/lib/search/search-types";

export type SearchMatchType = "exact" | "prefix" | "keyword" | "editorial";

export type RankedSearchResult = SearchDocument & {
  score: number;
  matchType: SearchMatchType;
};

export type RankedSearchResults = {
  query: string;
  normalizedQuery: string;
  total: number;
  entries: RankedSearchResult[];
  collections: RankedSearchResult[];
};

function scoreDocument(query: string, document: SearchDocument): RankedSearchResult | null {
  const normalizedTitle = normalizeSearchQuery(document.title);
  const normalizedSubtitle = normalizeSearchQuery(document.subtitle);
  const normalizedDescription = normalizeSearchQuery(document.description);
  const normalizedKeywords = document.keywords.map((keyword) => normalizeSearchQuery(keyword));

  let score = 0;
  let matchType: SearchMatchType = "editorial";

  if (normalizedTitle === query || normalizedKeywords.includes(query)) {
    score = 140;
    matchType = "exact";
  } else if (
    normalizedTitle.startsWith(query) ||
    normalizedKeywords.some((keyword) => keyword.startsWith(query))
  ) {
    score = 110;
    matchType = "prefix";
  } else if (
    normalizedTitle.includes(query) ||
    normalizedSubtitle.includes(query) ||
    normalizedDescription.includes(query) ||
    normalizedKeywords.some((keyword) => keyword.includes(query))
  ) {
    score = 78;
    matchType = "keyword";
  } else if (document.searchText.includes(query)) {
    score = 38;
    matchType = "editorial";
  }

  if (!score) {
    return null;
  }

  if (document.kind === "entry") {
    score += 6;
  }

  if (document.kind === "collection" && score < 70) {
    return null;
  }

  return {
    ...document,
    score,
    matchType
  };
}

export function searchEntries(query: string, documents: SearchDocument[]): RankedSearchResults {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery) {
    return {
      query,
      normalizedQuery,
      total: 0,
      entries: [],
      collections: []
    };
  }

  const ranked = documents
    .map((document) => scoreDocument(normalizedQuery, document))
    .filter((document): document is RankedSearchResult => Boolean(document))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.title.localeCompare(right.title);
    });

  const entries = ranked.filter((result) => result.kind === "entry");
  const collections = ranked.filter((result) => result.kind === "collection");

  return {
    query,
    normalizedQuery,
    total: ranked.length,
    entries,
    collections
  };
}

