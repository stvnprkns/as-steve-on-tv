import { createHash } from "node:crypto";

import {
  studyExclusionSchema,
  studyPopulationSchema,
  studyProtocolSchema,
  studyTitleSelectionSchema,
  STUDY_WINDOW_END,
  STUDY_WINDOW_START,
  type StudyCatalogTitle,
  type StudyExclusion,
  type StudyPopulation,
  type StudyProtocol,
  type StudyTitleSelection
} from "@/src/lib/schema";

export const FEASIBILITY_RULE = "feasibility-v1";

export const FEASIBILITY_PROTOCOL: StudyProtocol = studyProtocolSchema.parse({
  id: "study-steve-extinction-feasibility-v1",
  version: "1",
  approvedStatus: "draft",
  window: { startYear: STUDY_WINDOW_START, endYear: STUDY_WINDOW_END },
  filmsPerDecade: 100,
  seriesPerDecade: 50,
  seed: "steve-studies-feasibility-v1",
  samplingMethod: "feasibility_stratified_decade_genre",
  panels: ["film", "tv"],
  eligibilityPolicy:
    "Fictional named actor and actress credits in selected films and TV series. Self credits, unnamed roles, and non-performers stay out of the eligible set. Production country is not inferred.",
  freeze:
    "The study window is the 1960 through 2025 cutoff. A later year present in a source file is kept as source data and left out of the window. No 2026 value is estimated.",
  trackedBirthNames: ["Steve", "Steven", "Stephen", "Stevie"],
  controlNames: ["John", "David", "Michael", "Robert"],
  suppression: "An SSA count under 5, or a missing name, sex, and birth year, is suppressed_or_absent with a null count.",
  primaryOutcomeCalculated: false
});

export function withProtocol(overrides: Partial<StudyProtocol> = {}): StudyProtocol {
  return studyProtocolSchema.parse({ ...FEASIBILITY_PROTOCOL, ...overrides });
}

export function studyDecades(): number[] {
  const decades: number[] = [];

  for (let decade = STUDY_WINDOW_START; decade <= STUDY_WINDOW_END; decade += 10) {
    decades.push(decade);
  }

  return decades;
}

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

export function primaryGenre(genres: readonly string[]): string {
  const first = genres.map((genre) => genre.trim().toLowerCase()).find((genre) => genre.length > 0);

  if (!first) {
    return "unknown";
  }

  const slug = first
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "unknown";
}

export type FeasibilitySelection = {
  population: StudyPopulation;
  selections: StudyTitleSelection[];
  exclusions: StudyExclusion[];
};

/**
 * Draws the feasibility frame from work metadata only.
 * Character names are not an argument and cannot influence inclusion.
 */
export function selectFeasibilitySample(input: {
  titles: readonly StudyCatalogTitle[];
  protocol?: StudyProtocol;
  now: string;
}): FeasibilitySelection {
  const protocol = input.protocol ?? FEASIBILITY_PROTOCOL;
  const population = studyPopulationSchema.parse({
    id: protocol.id,
    specification: protocol,
    medium: "film_and_tv",
    coverageStart: STUDY_WINDOW_START,
    coverageEnd: STUDY_WINDOW_END,
    eligibilityPolicy: protocol.eligibilityPolicy,
    samplingMethod: protocol.samplingMethod,
    version: protocol.version,
    approvedStatus: protocol.approvedStatus,
    createdAt: input.now
  });
  const exclusions: StudyExclusion[] = [];
  const frame: EligibleTitle[] = [];
  const seen = new Set<string>();

  for (const title of [...input.titles].sort(compareTitles)) {
    const key = `${title.provider}\0${title.providerId}`;

    if (seen.has(key)) {
      exclusions.push(exclusion(population.id, title.providerId, "duplicate_catalog_title", input.now));
      continue;
    }

    seen.add(key);
    const classified = classifySamplingUnit(title);

    if (!classified.ok) {
      exclusions.push(exclusion(population.id, title.providerId, classified.reason, input.now));
      continue;
    }

    frame.push({ title, ...classified });
  }

  const selections = drawFrame(population.id, protocol, frame, input.now);

  return {
    population,
    selections: selections.sort((left, right) => left.id.localeCompare(right.id)),
    exclusions: exclusions.sort((left, right) => left.id.localeCompare(right.id))
  };
}

type EligibleTitle = {
  title: StudyCatalogTitle;
  medium: "film" | "tv";
  year: number;
  decade: number;
};

function classifySamplingUnit(
  title: StudyCatalogTitle
): { ok: true; medium: "film" | "tv"; year: number; decade: number } | { ok: false; reason: string } {
  if (title.titleType === "tvEpisode") {
    return { ok: false, reason: "episode_not_a_sampling_unit" };
  }

  if (title.titleType === "tvMovie") {
    return { ok: false, reason: "tv_movie_not_in_feasibility_panels" };
  }

  if (title.titleType === "short" || title.titleType === "video" || title.titleType === "videoGame") {
    return { ok: false, reason: "unresolved_medium" };
  }

  const medium = title.titleType === "movie" ? "film" : title.titleType === "tvSeries" || title.titleType === "tvMiniSeries" ? "tv" : null;

  if (!medium) {
    return { ok: false, reason: "not_a_series_sampling_unit" };
  }

  if (title.year === undefined) {
    return { ok: false, reason: "missing_year" };
  }

  if (title.year > STUDY_WINDOW_END) {
    return { ok: false, reason: "beyond_frozen_cutoff" };
  }

  if (title.year < STUDY_WINDOW_START) {
    return { ok: false, reason: "outside_study_window" };
  }

  return { ok: true, medium, year: title.year, decade: decadeOf(title.year) };
}

function drawFrame(
  studyId: string,
  protocol: StudyProtocol,
  frame: readonly EligibleTitle[],
  now: string
): StudyTitleSelection[] {
  const selections: StudyTitleSelection[] = [];

  for (const decade of studyDecades()) {
    for (const medium of ["film", "tv"] as const) {
      const quota = medium === "film" ? protocol.filmsPerDecade : protocol.seriesPerDecade;
      const cell = frame.filter((title) => title.decade === decade && title.medium === medium);
      const chosen = new Set(chooseTitles(cell, quota, protocol.seed).map((title) => title.title.providerId));
      const census = cell.length <= quota;

      for (const title of cell) {
        const genre = primaryGenre(title.title.genres);
        const stratumCount = cell.filter((candidate) => primaryGenre(candidate.title.genres) === genre).length;
        const stratumSelected = cell.filter(
          (candidate) => chosen.has(candidate.title.providerId) && primaryGenre(candidate.title.genres) === genre
        ).length;
        const probability = stratumCount === 0 ? 0 : round8(stratumSelected / stratumCount);
        const included = chosen.has(title.title.providerId);

        selections.push(
          studyTitleSelectionSchema.parse({
            id: stableId("selection", [studyId, title.title.provider, title.title.providerId]),
            studyId,
            workKey: stableId("work", [title.title.provider, title.title.providerId]),
            provider: "imdb",
            providerId: title.title.providerId,
            included,
            reason: included ? (census ? "feasibility_census" : "feasibility_stratum") : "not_drawn_in_stratum",
            samplingStratum: `${decade}:${medium}:${genre}`,
            decade,
            medium,
            inclusionProbability: probability,
            weight: included && probability > 0 ? round8(1 / probability) : undefined,
            metadataCoverage: {
              hasYear: true,
              hasGenre: genre !== "unknown",
              hasPopularity: title.title.votes !== undefined
            },
            createdAt: now
          })
        );
      }
    }
  }

  return selections;
}

function chooseTitles(cell: readonly EligibleTitle[], quota: number, seed: string): EligibleTitle[] {
  if (cell.length <= quota) {
    return [...cell];
  }

  const genres = new Map<string, EligibleTitle[]>();

  for (const title of cell) {
    const genre = primaryGenre(title.title.genres);
    const bucket = genres.get(genre) ?? [];
    bucket.push(title);
    genres.set(genre, bucket);
  }

  const seats = allocateSeats(
    [...genres.entries()].map(([key, titles]) => ({ key, count: titles.length })),
    quota
  );
  const chosen: EligibleTitle[] = [];

  for (const [genre, titles] of genres) {
    const ranked = [...titles].sort((left, right) => compareRank(left, right, seed));
    chosen.push(...ranked.slice(0, seats.get(genre) ?? 0));
  }

  return chosen;
}

function allocateSeats(groups: { key: string; count: number }[], seats: number): Map<string, number> {
  const total = groups.reduce((sum, group) => sum + group.count, 0);

  if (total <= seats) {
    return new Map(groups.map((group) => [group.key, group.count]));
  }

  const pieces = groups.map((group) => {
    const exact = (seats * group.count) / total;
    const floor = Math.floor(exact);
    return { ...group, floor, remainder: exact - floor };
  });
  const allocated = new Map(pieces.map((group) => [group.key, group.floor]));
  let used = pieces.reduce((sum, group) => sum + group.floor, 0);
  const order = [...pieces].sort((left, right) => right.remainder - left.remainder || left.key.localeCompare(right.key));
  let cursor = 0;

  while (used < seats && cursor < order.length * seats) {
    const group = order[cursor % order.length];
    const current = allocated.get(group.key) ?? 0;

    if (current < group.count) {
      allocated.set(group.key, current + 1);
      used += 1;
    }

    cursor += 1;
  }

  return allocated;
}

function compareRank(left: EligibleTitle, right: EligibleTitle, seed: string): number {
  const leftVotes = left.title.votes;
  const rightVotes = right.title.votes;

  if (leftVotes === undefined && rightVotes !== undefined) {
    return 1;
  }

  if (rightVotes === undefined && leftVotes !== undefined) {
    return -1;
  }

  if (leftVotes !== undefined && rightVotes !== undefined && leftVotes !== rightVotes) {
    return rightVotes - leftVotes;
  }

  const leftHash = rankHash(seed, left.title.providerId);
  const rightHash = rankHash(seed, right.title.providerId);
  return leftHash.localeCompare(rightHash) || left.title.providerId.localeCompare(right.title.providerId);
}

function compareTitles(left: StudyCatalogTitle, right: StudyCatalogTitle): number {
  return left.providerId.localeCompare(right.providerId) || left.title.localeCompare(right.title);
}

function rankHash(seed: string, providerId: string): string {
  return createHash("sha256").update(`${seed}\0${providerId}`).digest("hex");
}

function stableId(prefix: string, parts: readonly string[]): string {
  const digest = createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
  return `${prefix}-${digest}`;
}

function exclusion(studyId: string, recordId: string, reason: string, now: string): StudyExclusion {
  return studyExclusionSchema.parse({
    id: stableId("exclusion", [studyId, recordId, reason]),
    studyId,
    recordId,
    reason,
    rule: FEASIBILITY_RULE,
    createdAt: now
  });
}

function round8(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}
