import { createHash } from "node:crypto";

import { firstGivenNameToken, matchSteveGivenName, normalizeCharacterToken } from "@/src/lib/data/name-variants";
import { parseCharacterCredits } from "@/src/lib/data/normalize-character";
import { FEASIBILITY_RULE } from "@/src/lib/data/study-sample";
import {
  STUDY_WINDOW_END,
  STUDY_WINDOW_START,
  studyCharacterCreditSchema,
  studyExclusionSchema,
  studyIntroductionSchema,
  type StudyCatalogTitle,
  type StudyCharacterCredit,
  type StudyExclusion,
  type StudyIntroduction,
  type StudyTitleSelection,
  type StudyVariantLabel
} from "@/src/lib/schema";

const CONTROL_LABELS = {
  john: "john",
  david: "david",
  michael: "michael",
  robert: "robert"
} as const satisfies Record<string, StudyVariantLabel>;

function controlLabel(token: string): StudyVariantLabel | null {
  return token in CONTROL_LABELS ? CONTROL_LABELS[token as keyof typeof CONTROL_LABELS] : null;
}
const PERFORMER_CATEGORIES = new Set(["actor", "actress"]);

export type StudyPrincipal = {
  tconst: string;
  nconst: string;
  category: string;
  job: string;
  characters: string;
};

export type StudyCreditExtract = {
  credits: StudyCharacterCredit[];
  introductions: StudyIntroduction[];
  exclusions: StudyExclusion[];
};

type CreditGroup = {
  creditId: string;
  identityKey: string;
  creditedName: string;
  normalizedName: string;
  givenNameToken?: string;
  variantLabel: StudyVariantLabel;
  performerId: string;
  performerName?: string;
  workProviderId: string;
  decade: number;
  medium: "film" | "tv";
  episodeIds: string[];
  episodeYears: number[];
  filmYear?: number;
  eligible: boolean;
  exclusionReason?: string;
};

/**
 * Private study credits for every named character in the selected works.
 * This does not create public candidates, including for non-Steve names.
 */
export function extractStudyCredits(input: {
  studyId: string;
  selections: readonly StudyTitleSelection[];
  titles: readonly StudyCatalogTitle[];
  principals: readonly StudyPrincipal[];
  episodes?: readonly { tconst: string; parentTconst: string }[];
  names?: readonly { nconst: string; primaryName: string }[];
  now: string;
}): StudyCreditExtract {
  const selected = new Map(
    input.selections.filter((selection) => selection.included).map((selection) => [selection.providerId, selection])
  );
  const titles = new Map(input.titles.map((title) => [title.providerId, title]));
  const parentByEpisode = new Map((input.episodes ?? []).map((episode) => [episode.tconst, episode.parentTconst]));
  const performerNames = new Map((input.names ?? []).map((name) => [name.nconst, name.primaryName]));
  const groups = new Map<string, CreditGroup>();
  const exclusions: StudyExclusion[] = [];

  const principals = [...input.principals].sort(
    (left, right) =>
      left.tconst.localeCompare(right.tconst) ||
      left.nconst.localeCompare(right.nconst) ||
      left.characters.localeCompare(right.characters)
  );

  for (const principal of principals) {
    const located = locateWork(principal.tconst, selected, parentByEpisode);

    if (!located) {
      continue;
    }

    const category = principal.category.toLowerCase();
    const { selection, episodeId } = located;
    const recordId = `${principal.tconst}:${principal.nconst}:${category}`;

    if (category === "self") {
      const group = fictionalGroupKey(selection.providerId, principal.nconst, "self");
      if (groups.has(group)) {
        exclusions.push(log(input.studyId, recordId, "duplicate_credit", input.now, selection));
        continue;
      }

      groups.set(
        group,
        buildGroup({
          studyId: input.studyId,
          selection,
          performerId: principal.nconst,
          performerName: performerNames.get(principal.nconst),
          creditedName: "Self",
          normalizedName: "self",
          variantLabel: "other",
          eligible: false,
          exclusionReason: "self_credit",
          episodeId,
          episodeYear: episodeYear(episodeId, titles),
          filmYear: selection.medium === "film" ? titles.get(selection.providerId)?.year : undefined
        })
      );
      exclusions.push(log(input.studyId, recordId, "self_credit", input.now, selection));
      continue;
    }

    if (!PERFORMER_CATEGORIES.has(category)) {
      exclusions.push(log(input.studyId, recordId, "not_a_performer", input.now, selection));
      continue;
    }

    const characters = parseCharacterCredits(principal.characters);

    if (characters.length === 0) {
      exclusions.push(log(input.studyId, recordId, "unnamed_or_missing_role", input.now, selection));
      continue;
    }

    for (const creditedName of characters) {
      const classified = classifyStudyCredit(creditedName);

      if (!classified) {
        exclusions.push(log(input.studyId, recordId, "unnamed_or_missing_role", input.now, selection));
        continue;
      }

      const key = fictionalGroupKey(selection.providerId, principal.nconst, classified.normalizedName);
      const existing = groups.get(key);

      if (!existing) {
        groups.set(
          key,
          buildGroup({
            studyId: input.studyId,
            selection,
            performerId: principal.nconst,
            performerName: performerNames.get(principal.nconst),
            creditedName,
            normalizedName: classified.normalizedName,
            givenNameToken: classified.token,
            variantLabel: classified.label,
            eligible: true,
            episodeId,
            episodeYear: episodeYear(episodeId, titles),
            filmYear: selection.medium === "film" ? titles.get(selection.providerId)?.year : undefined
          })
        );
        continue;
      }

      if (episodeId && !existing.episodeIds.includes(episodeId)) {
        const alreadyHadEpisode = existing.episodeIds.length > 0;
        existing.episodeIds.push(episodeId);
        const year = episodeYear(episodeId, titles);

        if (year !== undefined) {
          existing.episodeYears.push(year);
        }

        if (alreadyHadEpisode) {
          exclusions.push(log(input.studyId, existing.creditId, "grouped_episode_credit", input.now, selection));
        }

        continue;
      }

      exclusions.push(log(input.studyId, existing.creditId, "duplicate_credit", input.now, selection));
    }
  }

  const credits: StudyCharacterCredit[] = [];
  const introductions: StudyIntroduction[] = [];

  for (const group of groups.values()) {
    const credit = studyCharacterCreditSchema.parse({
      id: group.creditId,
      studyId: input.studyId,
      provider: "imdb",
      workProviderId: group.workProviderId,
      decade: group.decade,
      medium: group.medium,
      creditedName: group.creditedName,
      normalizedName: group.normalizedName,
      ...(group.givenNameToken ? { givenNameToken: group.givenNameToken } : {}),
      variantLabel: group.variantLabel,
      eligible: group.eligible,
      ...(group.exclusionReason ? { exclusionReason: group.exclusionReason } : {}),
      performerId: group.performerId,
      ...(group.performerName ? { performerName: group.performerName } : {}),
      identityKey: group.identityKey,
      episodeIds: [...group.episodeIds].sort(),
      publicCandidate: false,
      createdAt: input.now
    });
    credits.push(credit);

    if (!credit.eligible) {
      continue;
    }

    const debut = debutFor(group);

    if ("reason" in debut) {
      exclusions.push(log(input.studyId, credit.id, debut.reason, input.now, { decade: credit.decade, medium: credit.medium }));
      continue;
    }

    introductions.push(
      studyIntroductionSchema.parse({
        id: stableId("introduction", [input.studyId, credit.identityKey]),
        studyId: input.studyId,
        identityKey: credit.identityKey,
        creditId: credit.id,
        firstAppearanceYear: debut.year,
        medium: credit.medium,
        eligible: true,
        provenance: debut.provenance,
        createdAt: input.now
      })
    );
  }

  return {
    credits: credits.sort((left, right) => left.id.localeCompare(right.id)),
    introductions: introductions.sort((left, right) => left.id.localeCompare(right.id)),
    exclusions: uniqueById(exclusions)
  };
}

export function classifyStudyCredit(
  creditedName: string
): { token?: string; label: StudyVariantLabel; normalizedName: string } | null {
  const normalizedName = normalizeCharacterToken(creditedName);

  if (!normalizedName) {
    return null;
  }

  const steve = matchSteveGivenName(creditedName);

  if (steve) {
    return { token: steve.token, label: steve.variant, normalizedName };
  }

  const given = firstGivenNameToken(creditedName);
  const control = given ? controlLabel(given) : null;

  if (given && control) {
    return { token: given, label: control, normalizedName };
  }

  return { token: given ?? undefined, label: "other", normalizedName };
}

function locateWork(
  tconst: string,
  selected: Map<string, StudyTitleSelection>,
  parentByEpisode: Map<string, string>
): { selection: StudyTitleSelection; episodeId?: string } | null {
  const direct = selected.get(tconst);

  if (direct) {
    return { selection: direct };
  }

  const parent = parentByEpisode.get(tconst);
  const series = parent ? selected.get(parent) : undefined;

  if (!series) {
    return null;
  }

  return { selection: series, episodeId: tconst };
}

function episodeYear(episodeId: string | undefined, titles: Map<string, StudyCatalogTitle>): number | undefined {
  if (!episodeId) {
    return undefined;
  }

  return titles.get(episodeId)?.year;
}

function buildGroup(input: {
  studyId: string;
  selection: StudyTitleSelection;
  performerId: string;
  performerName?: string;
  creditedName: string;
  normalizedName: string;
  givenNameToken?: string;
  variantLabel: StudyVariantLabel;
  eligible: boolean;
  exclusionReason?: string;
  episodeId?: string;
  episodeYear?: number;
  filmYear?: number;
}): CreditGroup {
  return {
    creditId: stableId("credit", [input.studyId, "imdb", input.selection.providerId, input.performerId, input.normalizedName]),
    identityKey: stableId("identity", [input.studyId, "imdb", input.selection.providerId, input.performerId, input.normalizedName]),
    creditedName: clip(input.creditedName, 200),
    normalizedName: input.normalizedName,
    givenNameToken: input.givenNameToken,
    variantLabel: input.variantLabel,
    performerId: input.performerId,
    performerName: input.performerName ? clip(input.performerName, 160) : undefined,
    workProviderId: input.selection.providerId,
    decade: input.selection.decade,
    medium: input.selection.medium,
    episodeIds: input.episodeId ? [input.episodeId] : [],
    episodeYears: input.episodeYear === undefined ? [] : [input.episodeYear],
    filmYear: input.filmYear,
    eligible: input.eligible,
    exclusionReason: input.exclusionReason
  };
}

function debutFor(
  group: CreditGroup
): { year: number; provenance: "film_release_year_proxy" | "earliest_verified_episode_year" } | { reason: string } {
  if (group.medium === "film") {
    return yearDecision(group.filmYear, "film_release_year_proxy");
  }

  const usable = group.episodeYears.filter((year) => year >= STUDY_WINDOW_START && year <= STUDY_WINDOW_END);

  if (usable.length > 0) {
    return { year: Math.min(...usable), provenance: "earliest_verified_episode_year" };
  }

  if (group.episodeYears.some((year) => year > STUDY_WINDOW_END)) {
    return { reason: "beyond_frozen_cutoff" };
  }

  if (group.episodeYears.some((year) => year < STUDY_WINDOW_START)) {
    return { reason: "outside_study_window" };
  }

  return { reason: "missing_debut_year" };
}

function yearDecision(
  year: number | undefined,
  provenance: "film_release_year_proxy"
): { year: number; provenance: "film_release_year_proxy" } | { reason: string } {
  if (year === undefined) {
    return { reason: "missing_debut_year" };
  }

  if (year > STUDY_WINDOW_END) {
    return { reason: "beyond_frozen_cutoff" };
  }

  if (year < STUDY_WINDOW_START) {
    return { reason: "outside_study_window" };
  }

  return { year, provenance };
}

function fictionalGroupKey(workId: string, performerId: string, normalizedName: string): string {
  return `${workId}\0${performerId}\0${normalizedName}`;
}

function log(
  studyId: string,
  recordId: string,
  reason: string,
  now: string,
  selection: Pick<StudyTitleSelection, "decade" | "medium">
): StudyExclusion {
  return studyExclusionSchema.parse({
    id: stableId("exclusion", [studyId, recordId, reason]),
    studyId,
    recordId,
    reason,
    rule: FEASIBILITY_RULE,
    decade: selection.decade,
    medium: selection.medium,
    createdAt: now
  });
}

function uniqueById(rows: StudyExclusion[]): StudyExclusion[] {
  const seen = new Set<string>();
  const unique: StudyExclusion[] = [];

  for (const row of [...rows].sort((left, right) => left.id.localeCompare(right.id))) {
    if (seen.has(row.id)) {
      continue;
    }

    seen.add(row.id);
    unique.push(row);
  }

  return unique;
}

function stableId(prefix: string, parts: readonly string[]): string {
  return `${prefix}-${createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24)}`;
}

function clip(value: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trim();
}
