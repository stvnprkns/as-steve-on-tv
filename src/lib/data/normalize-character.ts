import { createHash } from "node:crypto";

import {
  candidateEntrySchema,
  sourcePersonRecordSchema,
  sourceTitleRecordSchema,
  type CandidateEntry,
  type ModerationStatus,
  type SourcePersonRecord,
  type SourceTitleRecord
} from "@/src/lib/schema";
import {
  matchPerformerGivenName,
  matchSteveGivenName,
  normalizeCharacterToken,
  type SteveGivenNameMatch
} from "@/src/lib/data/name-variants";

export const REVIEWED_MODERATION_STATUSES = [
  "under_review",
  "accepted",
  "rejected",
  "merged",
  "needs_more_evidence"
] as const satisfies readonly ModerationStatus[];

const REVIEWED_STATUS_SET = new Set<string>(REVIEWED_MODERATION_STATUSES);

const TV_TITLE_TYPES = new Set(["tvSeries", "tvMiniSeries", "tvEpisode", "tvSpecial", "tvShort"]);

const UNRESOLVED_TITLE_TYPES = new Set(["short", "video", "videoGame"]);

export const TV_MOVIE_MEDIUM_NOTE =
  "IMDb titleType tvMovie is stored as tv until the schema can record film plus a distribution attribute.";

export type MediumClassification =
  | { disposition: "candidate"; medium: "tv" | "film"; note?: string }
  | { disposition: "unresolved"; reason: string };

export type ImdbTitleRow = {
  tconst: string;
  titleType: string;
  primaryTitle: string;
  startYear: number;
  endYear?: number;
};

export type ImdbNameRow = {
  nconst: string;
  primaryName: string;
};

export type ImdbPrincipalRow = {
  tconst: string;
  nconst: string;
  category: string;
  job: string;
  characters: string;
};

export type ImdbEpisodeRow = {
  tconst: string;
  parentTconst: string;
  seasonNumber?: string;
  episodeNumber?: string;
};

export type UnresolvedTitle = {
  tconst: string;
  titleType: string;
  primaryTitle: string;
  reason: string;
};

export type DiscoveryCounts = {
  recordsScanned: number;
  skippedMissingRecord: number;
  skippedNonPerformer: number;
  skippedUnmatchedCredit: number;
  unresolvedTitles: number;
};

export type DiscoveryResult = {
  candidates: CandidateEntry[];
  sourceTitles: SourceTitleRecord[];
  sourcePeople: SourcePersonRecord[];
  unresolved: UnresolvedTitle[];
  counts: DiscoveryCounts;
};

type IdentityResolution = "series_grouped" | "episode_ungrouped" | "work_credit";
type SourceType = "character_credit" | "self_credit";

type ResolvedWork = {
  workOrSeriesId: string;
  title: ImdbTitleRow;
  classification: Extract<MediumClassification, { disposition: "candidate" }>;
  episodeId?: string;
  identityResolution: IdentityResolution;
};

type CandidateGroup = {
  displayName: string;
  nameVariant: SteveGivenNameMatch["variant"];
  entryType: "character" | "person";
  matchConfidence: "high" | "medium";
  matchReason: string;
  notes: string[];
  actorOrPerson: string;
  performerId: string;
  characterToken: string;
  workOrSeriesId: string;
  sourceType: SourceType;
  identityResolution: IdentityResolution;
  episodeIds: Set<string>;
  work: ResolvedWork;
  category: string;
};

/**
 * `movie` is film. Television types, including `tvShort` and `tvMovie`, stay tv.
 * `short`, `video`, and `videoGame` are unresolved and are never commercials.
 */
export function classifyImdbTitleType(titleType: string): MediumClassification {
  if (titleType === "movie") {
    return { disposition: "candidate", medium: "film" };
  }

  if (titleType === "tvMovie") {
    return { disposition: "candidate", medium: "tv", note: TV_MOVIE_MEDIUM_NOTE };
  }

  if (TV_TITLE_TYPES.has(titleType)) {
    return { disposition: "candidate", medium: "tv" };
  }

  if (UNRESOLVED_TITLE_TYPES.has(titleType)) {
    return {
      disposition: "unresolved",
      reason: `IMDb titleType "${titleType}" is not written as a candidate. Shorts, videos, and video games are not commercials.`
    };
  }

  return {
    disposition: "unresolved",
    reason: `IMDb titleType "${titleType}" has no Phase 1 medium mapping and is not written as a candidate.`
  };
}

/** Parse an IMDb `characters` JSON array. `\N`, empty fields, and junk yield no credits. */
export function parseCharacterCredits(value: string | undefined): string[] {
  const raw = (value ?? "").trim();

  if (!raw || raw === "\\N") {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }

    if (typeof parsed === "string" && parsed.trim()) {
      return [parsed.trim()];
    }
  } catch {
    const quoted = [...raw.matchAll(/"((?:\\.|[^"\\])*)"/g)]
      .map((match) => match[1].replace(/\\"/g, '"').trim())
      .filter((item) => item.length > 0);

    return quoted;
  }

  return [];
}

export function buildCandidateId(input: {
  provider: string;
  workOrSeriesId: string;
  performerId: string;
  characterToken: string;
}): string {
  const digest = createHash("sha256")
    .update([input.provider, input.workOrSeriesId, input.performerId, input.characterToken].join("\0"))
    .digest("hex")
    .slice(0, 24);

  return `candidate-${digest}`;
}

export function isReviewedModerationStatus(status: string): status is ModerationStatus {
  return REVIEWED_STATUS_SET.has(status);
}

export function preferReviewedStatus(columnStatus: string, payloadStatus: string): ModerationStatus {
  if (isReviewedModerationStatus(columnStatus)) {
    return columnStatus;
  }

  if (isReviewedModerationStatus(payloadStatus)) {
    return payloadStatus;
  }

  return "pending_review";
}

export function candidateCharacterToken(candidate: Pick<CandidateEntry, "matchedName" | "entryType" | "payload">): string {
  const explicit = candidate.payload.characterToken;

  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim();
  }

  const normalized = normalizeCharacterToken(candidate.matchedName);

  if (!normalized) {
    return "";
  }

  return candidate.entryType === "person" ? `self:${normalized}` : normalized;
}

export function candidateWorkIds(candidate: Pick<CandidateEntry, "imdbTitleId" | "payload">): string[] {
  const ids: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string" && value && !ids.includes(value)) {
      ids.push(value);
    }
  };

  push(candidate.payload.workOrSeriesId);
  push(candidate.imdbTitleId);

  if (Array.isArray(candidate.payload.episodeIds)) {
    for (const episodeId of candidate.payload.episodeIds) {
      push(episodeId);
    }
  }

  return ids;
}

export function sameCandidateIdentity(
  left: Pick<CandidateEntry, "imdbNameId" | "imdbTitleId" | "matchedName" | "entryType" | "payload">,
  right: Pick<CandidateEntry, "imdbNameId" | "imdbTitleId" | "matchedName" | "entryType" | "payload">
): boolean {
  if (!left.imdbNameId || left.imdbNameId !== right.imdbNameId) {
    return false;
  }

  const leftToken = candidateCharacterToken(left);
  const rightToken = candidateCharacterToken(right);

  if (!leftToken || leftToken !== rightToken) {
    return false;
  }

  const rightIds = new Set(candidateWorkIds(right));
  return candidateWorkIds(left).some((id) => rightIds.has(id));
}

export function mergeModerationState(
  existing: Pick<CandidateEntry, "status" | "linkedPublishedEntryId">,
  incoming: Pick<CandidateEntry, "status" | "linkedPublishedEntryId">
): Pick<CandidateEntry, "status" | "linkedPublishedEntryId"> {
  return {
    status: isReviewedModerationStatus(existing.status) ? existing.status : incoming.status,
    linkedPublishedEntryId: existing.linkedPublishedEntryId ?? incoming.linkedPublishedEntryId
  };
}

export function overlayDatabaseReviewState(
  stored: CandidateEntry,
  column: {
    id: string;
    slug: string;
    status: string;
    linkedPublishedEntryId: string | null;
    createdAt?: string;
  }
): CandidateEntry {
  return {
    ...stored,
    id: column.id,
    slug: column.slug,
    status: preferReviewedStatus(column.status, stored.status),
    linkedPublishedEntryId: column.linkedPublishedEntryId ?? stored.linkedPublishedEntryId,
    createdAt: column.createdAt ?? stored.createdAt
  };
}

/**
 * Fold a new discovery pass into rows that were already reviewed.
 * Same IMDb title (or grouped episode), person, and character keep the existing
 * id and do not return to `pending_review`.
 */
export function reconcileCandidatesWithReviewed(incoming: CandidateEntry[], existing: CandidateEntry[]): CandidateEntry[] {
  const usedExistingIds = new Set<string>();
  const reconciled: CandidateEntry[] = [];

  for (const candidate of incoming) {
    const exact = existing.find((row) => row.id === candidate.id && !usedExistingIds.has(row.id));
    const identity = existing.find((row) => !usedExistingIds.has(row.id) && sameCandidateIdentity(row, candidate));
    const match = exact ?? identity;

    if (!match) {
      const alreadyKept = reconciled.find((row) => row.id === candidate.id || sameCandidateIdentity(row, candidate));

      if (!alreadyKept) {
        reconciled.push(candidate);
      }

      continue;
    }

    usedExistingIds.add(match.id);
    const moderation = mergeModerationState(match, candidate);

    reconciled.push({
      ...candidate,
      id: match.id,
      slug: match.slug,
      createdAt: match.createdAt,
      status: moderation.status,
      linkedPublishedEntryId: moderation.linkedPublishedEntryId,
      notesOnUncertainty: candidate.notesOnUncertainty ?? match.notesOnUncertainty,
      ...((match.reviewDisposition ?? candidate.reviewDisposition)
        ? { reviewDisposition: match.reviewDisposition ?? candidate.reviewDisposition }
        : {}),
      ...((match.identityId ?? candidate.identityId) ? { identityId: match.identityId ?? candidate.identityId } : {}),
      payload: {
        ...match.payload,
        ...candidate.payload
      }
    });
  }

  return reconciled;
}

export function parseTitleBasicsLine(line: string): ImdbTitleRow | null {
  const [tconst, titleType, primaryTitle, , , startYear, endYear] = line.split("\t");
  const parsedStartYear = Number.parseInt(startYear ?? "", 10);

  if (!tconst || !titleType || !primaryTitle || Number.isNaN(parsedStartYear)) {
    return null;
  }

  const parsedEndYear = Number.parseInt(endYear ?? "", 10);

  return {
    tconst,
    titleType,
    primaryTitle,
    startYear: parsedStartYear,
    endYear: Number.isNaN(parsedEndYear) ? undefined : parsedEndYear
  };
}

export function parseNameBasicsLine(line: string): ImdbNameRow | null {
  const [nconst, primaryName] = line.split("\t");

  if (!nconst || !primaryName) {
    return null;
  }

  return { nconst, primaryName };
}

/** IMDb principals columns are tconst, ordering, nconst, category, job, characters. */
export function parsePrincipalLine(line: string): ImdbPrincipalRow | null {
  const [tconst, , nconst, category, job, characters] = line.split("\t");

  if (!tconst || !nconst || !category) {
    return null;
  }

  return {
    tconst,
    nconst,
    category,
    job: !job || job === "\\N" ? "" : job,
    characters: !characters || characters === "\\N" ? "" : characters
  };
}

export function parseEpisodeLine(line: string): ImdbEpisodeRow | null {
  const [tconst, parentTconst, seasonNumber, episodeNumber] = line.split("\t");

  if (!tconst || !parentTconst || parentTconst === "\\N") {
    return null;
  }

  return {
    tconst,
    parentTconst,
    seasonNumber: !seasonNumber || seasonNumber === "\\N" ? undefined : seasonNumber,
    episodeNumber: !episodeNumber || episodeNumber === "\\N" ? undefined : episodeNumber
  };
}

function clip(value: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trim();
}

function fitText(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function characterMatchReason(credit: string, variant: string): string {
  const reason = `Parsed character credit "${credit}" contains the anchored given-name token ${variant}.`;

  if (reason.length >= 20 && reason.length <= 320) {
    return reason;
  }

  return fitText(`Parsed character credit contains the anchored given-name token ${variant}.`, 320);
}

function selfMatchReason(variant: string): string {
  return `Self credit matched the performer's anchored given name ${variant}. It is not a fictional character credit.`;
}

function selfUncertaintyNote(): string {
  return "Self credit matched the performer's given name only. This is a person candidate, not a fictional character, and still needs on-screen confirmation.";
}

export function discoverImdbCandidates(input: {
  titles: ImdbTitleRow[];
  names: ImdbNameRow[];
  principals: ImdbPrincipalRow[];
  episodes?: ImdbEpisodeRow[];
  now?: string;
}): DiscoveryResult {
  const discovery = createImdbDiscovery({
    titles: input.titles,
    names: input.names,
    episodes: input.episodes ?? [],
    now: input.now
  });

  for (const principal of input.principals) {
    discovery.observePrincipal(principal);
  }

  return discovery.finish();
}

export function createImdbDiscovery(input: {
  titles: Iterable<ImdbTitleRow>;
  names: Iterable<ImdbNameRow>;
  episodes?: Iterable<ImdbEpisodeRow>;
  now?: string;
}) {
  const titles = new Map<string, ImdbTitleRow>();
  const names = new Map<string, ImdbNameRow>();
  const episodes = new Map<string, ImdbEpisodeRow>();
  const unresolved = new Map<string, UnresolvedTitle>();
  const groups = new Map<string, CandidateGroup>();
  const now = input.now ?? new Date().toISOString();
  let recordsScanned = 0;
  let skippedMissingRecord = 0;
  let skippedNonPerformer = 0;
  let skippedUnmatchedCredit = 0;

  for (const title of input.titles) {
    titles.set(title.tconst, title);
  }

  for (const name of input.names) {
    names.set(name.nconst, name);
  }

  for (const episode of input.episodes ?? []) {
    episodes.set(episode.tconst, episode);
  }

  function resolveWork(tconst: string): ResolvedWork | null {
    const title = titles.get(tconst);

    if (!title) {
      return null;
    }

    const ownClassification = classifyImdbTitleType(title.titleType);

    if (ownClassification.disposition === "unresolved") {
      return null;
    }

    if (title.titleType === "tvEpisode") {
      const episode = episodes.get(tconst);
      const parent = episode ? titles.get(episode.parentTconst) : undefined;
      const parentClassification = parent ? classifyImdbTitleType(parent.titleType) : null;

      if (episode && parent && parentClassification?.disposition === "candidate") {
        return {
          workOrSeriesId: parent.tconst,
          title: parent,
          classification: parentClassification,
          episodeId: tconst,
          identityResolution: "series_grouped"
        };
      }

      return {
        workOrSeriesId: title.tconst,
        title,
        classification: ownClassification,
        episodeId: tconst,
        identityResolution: "episode_ungrouped"
      };
    }

    return {
      workOrSeriesId: title.tconst,
      title,
      classification: ownClassification,
      identityResolution: "work_credit"
    };
  }

  function addGroup(group: CandidateGroup) {
    const key = ["imdb_bulk", group.workOrSeriesId, group.performerId, group.characterToken].join("\0");
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, group);
      return;
    }

    if (group.episodeIds.size > 0) {
      for (const episodeId of group.episodeIds) {
        existing.episodeIds.add(episodeId);
      }
    }

    if (group.identityResolution === "series_grouped" || existing.identityResolution === "series_grouped") {
      existing.identityResolution = "series_grouped";
    } else if (group.identityResolution === "episode_ungrouped" || existing.identityResolution === "episode_ungrouped") {
      existing.identityResolution = "episode_ungrouped";
    }

    for (const note of group.notes) {
      if (!existing.notes.includes(note)) {
        existing.notes.push(note);
      }
    }
  }

  return {
    observePrincipal(row: ImdbPrincipalRow) {
      recordsScanned += 1;
      const title = titles.get(row.tconst);
      const person = names.get(row.nconst);

      if (!title || !person) {
        skippedMissingRecord += 1;
        return;
      }

      const classification = classifyImdbTitleType(title.titleType);

      if (classification.disposition === "unresolved") {
        unresolved.set(title.tconst, {
          tconst: title.tconst,
          titleType: title.titleType,
          primaryTitle: title.primaryTitle,
          reason: classification.reason
        });
        return;
      }

      const category = row.category.trim().toLowerCase();

      if (category !== "actor" && category !== "actress" && category !== "self") {
        skippedNonPerformer += 1;
        return;
      }

      const work = resolveWork(row.tconst);

      if (!work) {
        skippedMissingRecord += 1;
        return;
      }

      if (category === "self") {
        const givenName = matchPerformerGivenName(person.primaryName);

        if (!givenName) {
          skippedUnmatchedCredit += 1;
          return;
        }

        const personToken = normalizeCharacterToken(person.primaryName);
        const notes = [selfUncertaintyNote()];

        if (work.classification.note) {
          notes.push(work.classification.note);
        }

        addGroup({
          displayName: clip(person.primaryName, 120),
          nameVariant: givenName.variant,
          entryType: "person",
          matchConfidence: "medium",
          matchReason: selfMatchReason(givenName.variant),
          notes,
          actorOrPerson: clip(person.primaryName, 160),
          performerId: person.nconst,
          characterToken: `self:${personToken}`,
          workOrSeriesId: work.workOrSeriesId,
          sourceType: "self_credit",
          identityResolution: work.identityResolution,
          episodeIds: new Set(work.episodeId ? [work.episodeId] : []),
          work,
          category
        });
        return;
      }

      const matches = parseCharacterCredits(row.characters)
        .map((credit) => ({ credit, match: matchSteveGivenName(credit) }))
        .filter((item): item is { credit: string; match: SteveGivenNameMatch } => item.match !== null);

      if (matches.length === 0) {
        skippedUnmatchedCredit += 1;
        return;
      }

      for (const item of matches) {
        const notes = work.classification.note ? [work.classification.note] : [];

        addGroup({
          displayName: clip(item.credit, 120),
          nameVariant: item.match.variant,
          entryType: "character",
          matchConfidence: "high",
          matchReason: characterMatchReason(item.credit, item.match.variant),
          notes,
          actorOrPerson: clip(person.primaryName, 160),
          performerId: person.nconst,
          characterToken: normalizeCharacterToken(item.credit),
          workOrSeriesId: work.workOrSeriesId,
          sourceType: "character_credit",
          identityResolution: work.identityResolution,
          episodeIds: new Set(work.episodeId ? [work.episodeId] : []),
          work,
          category
        });
      }
    },
    finish(): DiscoveryResult {
      const sourceTitles = new Map<string, SourceTitleRecord>();
      const sourcePeople = new Map<string, SourcePersonRecord>();
      const candidates: CandidateEntry[] = [];

      for (const group of groups.values()) {
        const sourceTitleId = `source-title-${group.work.title.tconst}`;
        const sourcePersonId = `source-person-${group.performerId}`;
        const candidateId = buildCandidateId({
          provider: "imdb_bulk",
          workOrSeriesId: group.workOrSeriesId,
          performerId: group.performerId,
          characterToken: group.characterToken
        });
        const episodeIds = [...group.episodeIds].sort();
        const uncertainty = group.notes.join(" ").trim();
        const notesOnUncertainty = uncertainty.length >= 12 ? fitText(uncertainty, 280) : undefined;
        const titleOfWork = clip(group.work.title.primaryTitle, 160);
        const nestedPayload: Record<string, unknown> = {
          displayName: group.displayName,
          canonicalName: group.displayName,
          nameVariant: group.nameVariant,
          medium: group.work.classification.medium,
          titleOfWork,
          actorOrPerson: group.actorOrPerson,
          yearStart: group.work.title.startYear,
          entryType: group.entryType,
          externalRefs: {
            imdbTitleId: group.workOrSeriesId,
            imdbNameId: group.performerId
          },
          nameMatchReason: group.matchReason,
          sourceType: group.sourceType,
          identityResolution: group.identityResolution,
          characterToken: group.characterToken,
          workOrSeriesId: group.workOrSeriesId,
          performerId: group.performerId,
          episodeIds,
          titleType: group.work.title.titleType,
          provider: "imdb_bulk"
        };

        if (group.work.title.endYear !== undefined) {
          nestedPayload.yearEnd = group.work.title.endYear;
        }

        if (notesOnUncertainty) {
          nestedPayload.uncertaintyReason = notesOnUncertainty;
        }

        const candidate = candidateEntrySchema.parse({
          id: candidateId,
          slug: candidateId,
          displayName: group.displayName,
          canonicalName: group.displayName,
          matchedName: group.displayName,
          nameVariant: group.nameVariant,
          entryType: group.entryType,
          medium: group.work.classification.medium,
          titleOfWork,
          actorOrPerson: group.actorOrPerson,
          yearStart: group.work.title.startYear,
          ...(group.work.title.endYear !== undefined ? { yearEnd: group.work.title.endYear } : {}),
          matchConfidence: group.matchConfidence,
          matchReason: group.matchReason,
          status: "pending_review",
          imdbTitleId: group.workOrSeriesId,
          imdbNameId: group.performerId,
          sourceTitleId,
          sourcePersonId,
          linkedPublishedEntryId: null,
          ...(notesOnUncertainty ? { notesOnUncertainty } : {}),
          payload: nestedPayload,
          evidenceLabels:
            group.sourceType === "self_credit"
              ? ["IMDb bulk self credit matched on given name"]
              : ["IMDb bulk principal character credit"],
          createdAt: now,
          updatedAt: now
        });

        candidates.push(candidate);

        if (!sourceTitles.has(sourceTitleId)) {
          sourceTitles.set(
            sourceTitleId,
            sourceTitleRecordSchema.parse({
              id: sourceTitleId,
              provider: "imdb_bulk",
              providerTitleId: group.work.title.tconst,
              imdbTitleId: group.work.title.tconst,
              title: clip(group.work.title.primaryTitle, 200),
              medium: group.work.classification.medium,
              yearStart: group.work.title.startYear,
              ...(group.work.title.endYear !== undefined ? { yearEnd: group.work.title.endYear } : {}),
              rawPayloadHash: createHash("sha1")
                .update(`${group.work.title.tconst}:${group.work.title.primaryTitle}:${group.work.title.startYear}`)
                .digest("hex"),
              payload: {
                tconst: group.work.title.tconst,
                titleType: group.work.title.titleType,
                primaryTitle: group.work.title.primaryTitle,
                ...(group.work.classification.note ? { mediumNote: group.work.classification.note } : {})
              },
              fetchedAt: now,
              createdAt: now,
              updatedAt: now
            })
          );
        }

        if (!sourcePeople.has(sourcePersonId)) {
          sourcePeople.set(
            sourcePersonId,
            sourcePersonRecordSchema.parse({
              id: sourcePersonId,
              provider: "imdb_bulk",
              providerPersonId: group.performerId,
              imdbNameId: group.performerId,
              displayName: group.actorOrPerson,
              rawPayloadHash: createHash("sha1").update(`${group.performerId}:${group.actorOrPerson}`).digest("hex"),
              payload: {
                nconst: group.performerId,
                primaryName: group.actorOrPerson,
                category: group.category
              },
              fetchedAt: now,
              createdAt: now,
              updatedAt: now
            })
          );
        }
      }

      const unresolvedTitles = [...unresolved.values()].sort((left, right) => left.tconst.localeCompare(right.tconst));

      return {
        candidates,
        sourceTitles: [...sourceTitles.values()],
        sourcePeople: [...sourcePeople.values()],
        unresolved: unresolvedTitles,
        counts: {
          recordsScanned,
          skippedMissingRecord,
          skippedNonPerformer,
          skippedUnmatchedCredit,
          unresolvedTitles: unresolvedTitles.length
        }
      };
    }
  };
}
