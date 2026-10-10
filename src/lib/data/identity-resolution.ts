import { createHash } from "node:crypto";

import { candidateCharacterToken } from "@/src/lib/data/normalize-character";
import { matchSteveGivenName, normalizeCharacterToken, STEVE_GIVEN_NAMES } from "@/src/lib/data/name-variants";
import type { CandidateEntry, SteveEntry } from "@/src/lib/schema";
import {
  characterAppearanceSchema,
  characterIdentitySchema,
  workIdentitySchema,
  type CharacterAppearance,
  type CharacterIdentity,
  type ReviewDisposition,
  type WorkIdentity
} from "@/src/lib/schema/identity-appearance";
import {
  reviewActionSchema,
  sourceEvidenceSchema,
  type ReviewAction,
  type SourceEvidence
} from "@/src/lib/schema/source-evidence";

export const reviewDispositionLabels: Record<ReviewDisposition, string> = {
  new_identity: "New identity",
  new_appearance: "New appearance",
  duplicate: "Duplicate",
  out_of_scope: "Out of scope",
  needs_evidence: "Needs evidence"
};

export type IdentityRegistry = {
  identities: CharacterIdentity[];
  works: WorkIdentity[];
  appearances: CharacterAppearance[];
};

export type PublishedEntryRef = Pick<SteveEntry, "id" | "slug" | "displayName" | "canonicalName" | "externalRefs">;

export type PublishedCitation = {
  entryId: string;
  slug: string;
  reason: string;
};

export type IdentityPlan = {
  disposition: ReviewDisposition;
  reason: string;
  provisional: boolean;
  rewritesPublishedSlug: false;
  identity: CharacterIdentity | null;
  works: WorkIdentity[];
  appearances: CharacterAppearance[];
  evidence: SourceEvidence[];
  relatedIdentityIds: string[];
  publishedCitations: PublishedCitation[];
};

const GIVEN_NAME_ONLY = new Set<string>(STEVE_GIVEN_NAMES);

export function emptyIdentityRegistry(): IdentityRegistry {
  return { identities: [], works: [], appearances: [] };
}

function stableId(prefix: string, parts: readonly string[]) {
  const digest = createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
  return `${prefix}-${digest}`;
}

function clip(value: string, max: number) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trim();
}

function performerIdOf(candidate: CandidateEntry) {
  const fromPayload = candidate.payload.performerId;

  if (typeof fromPayload === "string" && fromPayload.trim()) {
    return fromPayload.trim();
  }

  if (candidate.imdbNameId) {
    return candidate.imdbNameId;
  }

  const slug = normalizeCharacterToken(candidate.actorOrPerson).replace(/\s+/g, "-");
  return slug ? `name-${slug}` : "performer-unknown";
}

function workOrSeriesIdOf(candidate: CandidateEntry) {
  const fromPayload = candidate.payload.workOrSeriesId;

  if (typeof fromPayload === "string" && fromPayload.trim()) {
    return fromPayload.trim();
  }

  return candidate.imdbTitleId ?? candidate.sourceTitleId;
}

function episodeIdsOf(candidate: CandidateEntry) {
  const raw = candidate.payload.episodeIds;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((episodeId): episodeId is string => typeof episodeId === "string" && episodeId.trim().length > 0);
}

function representationOf(candidate: CandidateEntry): CharacterIdentity["representation"] {
  if (candidate.entryType === "persona") {
    return "persona";
  }

  if (candidate.entryType === "person" || candidate.payload.sourceType === "self_credit") {
    return "self";
  }

  return "fictional";
}

function needsEvidence(candidate: CandidateEntry) {
  return candidate.payload.sourceType === "self_credit" || candidate.matchConfidence === "low" || (candidate.entryType === "person" && candidate.matchConfidence !== "high");
}

function inScope(candidate: CandidateEntry) {
  const token = candidateCharacterToken(candidate).replace(/^self:/, "");
  return Boolean(matchSteveGivenName(token) || matchSteveGivenName(candidate.matchedName));
}

function publishedCitationsFor(candidate: CandidateEntry, publishedEntries: readonly PublishedEntryRef[]): PublishedCitation[] {
  const names = new Set(
    [candidate.displayName, candidate.canonicalName, candidate.matchedName]
      .map((name) => normalizeCharacterToken(name))
      .filter(Boolean)
  );

  return publishedEntries
    .filter((entry) => names.has(normalizeCharacterToken(entry.displayName)) || names.has(normalizeCharacterToken(entry.canonicalName)))
    .map((entry) => ({
      entryId: entry.id,
      slug: entry.slug,
      reason: `Published slug ${entry.slug} uses the same display name. It was not merged or rewritten.`
    }));
}

function blankPlan(
  disposition: ReviewDisposition,
  reason: string,
  publishedCitations: PublishedCitation[],
  provisional = false
): IdentityPlan {
  return {
    disposition,
    reason,
    provisional,
    rewritesPublishedSlug: false,
    identity: null,
    works: [],
    appearances: [],
    evidence: [],
    relatedIdentityIds: [],
    publishedCitations
  };
}

export function resolveCandidateIdentity(input: {
  candidate: CandidateEntry;
  registry?: IdentityRegistry;
  publishedEntries?: readonly PublishedEntryRef[];
  now?: string;
}): IdentityPlan {
  const registry = input.registry ?? emptyIdentityRegistry();
  const publishedEntries = input.publishedEntries ?? [];
  const now = input.now ?? new Date().toISOString();
  const citations = publishedCitationsFor(input.candidate, publishedEntries);

  if (!inScope(input.candidate)) {
    return blankPlan(
      "out_of_scope",
      "No anchored Steve, Steven, Stephen, or Stevie given name is present. Same-name substrings such as Stevenson are not an identity.",
      citations
    );
  }

  const characterToken = candidateCharacterToken(input.candidate);
  const performerId = performerIdOf(input.candidate);
  const workOrSeriesId = workOrSeriesIdOf(input.candidate);
  const normalizedName = characterToken;
  const proposedIdentityId = stableId("identity", ["imdb_bulk", workOrSeriesId, performerId, characterToken]);
  const existingIdentity = registry.identities.find(
    (identity) =>
      identity.mergeStatus !== "merged_into" &&
      identity.normalizedName === normalizedName &&
      identity.originPerformerId === performerId &&
      identity.originWorkId === workOrSeriesId
  );
  const identityId = existingIdentity?.id ?? proposedIdentityId;
  const relatedIdentityIds = registry.identities
    .filter(
      (identity) =>
        identity.id !== identityId &&
        identity.normalizedName === normalizedName &&
        !GIVEN_NAME_ONLY.has(normalizedName)
    )
    .map((identity) => identity.id);

  const episodeIds = episodeIdsOf(input.candidate);
  const units = episodeIds.length > 0 ? episodeIds : [workOrSeriesId];
  const works: WorkIdentity[] = [];
  const appearances: CharacterAppearance[] = [];
  const knownKeys = new Set(registry.appearances.map((appearance) => appearance.dedupeKey));

  for (const unit of units) {
    const providerWorkId = unit;
    const workType: WorkIdentity["workType"] =
      episodeIds.length > 0 ? "tv_episode" : input.candidate.medium === "film" ? "film" : input.candidate.medium === "commercial" ? "commercial" : "tv_series";
    const work = workIdentitySchema.parse({
      id: stableId("work", ["imdb_bulk", providerWorkId]),
      workType,
      title: clip(episodeIds.length > 0 ? `${input.candidate.titleOfWork} ${providerWorkId}` : input.candidate.titleOfWork, 200),
      ...(input.candidate.yearStart ? { releaseYear: input.candidate.yearStart } : {}),
      provenance: "phase-2 identity proposal",
      externalRefs: [{ provider: "imdb_bulk", providerId: providerWorkId }],
      createdAt: now,
      updatedAt: now
    });
    const dedupeKey = ["imdb_bulk", providerWorkId, performerId, characterToken].join("|").slice(0, 240);
    const appearance = characterAppearanceSchema.parse({
      id: stableId("appearance", ["imdb_bulk", providerWorkId, performerId, characterToken]),
      workId: work.id,
      characterId: identityId,
      performerId,
      performerName: clip(input.candidate.actorOrPerson, 160),
      creditedText: clip(input.candidate.matchedName, 200),
      namedCredit: true,
      evidenceStrength: input.candidate.matchConfidence,
      reviewState: "proposed",
      dedupeKey,
      createdAt: now,
      updatedAt: now
    });

    if (!knownKeys.has(appearance.dedupeKey)) {
      works.push(work);
      appearances.push(appearance);
    }
  }

  const identity = characterIdentitySchema.parse({
    id: identityId,
    creditedName: clip(input.candidate.matchedName, 160),
    canonicalName: clip(input.candidate.canonicalName, 160),
    normalizedName,
    nameVariant: input.candidate.nameVariant,
    representation: representationOf(input.candidate),
    mergeStatus: existingIdentity?.mergeStatus ?? "unmerged",
    originPerformerId: performerId,
    originWorkId: workOrSeriesId,
    createdAt: existingIdentity?.createdAt ?? now,
    updatedAt: now
  });

  const evidence = [
    sourceEvidenceSchema.parse({
      id: stableId("evidence", [input.candidate.id, identity.id]),
      candidateId: input.candidate.id,
      characterId: identity.id,
      provider: "imdb_bulk",
      reference: input.candidate.imdbTitleId ?? input.candidate.sourceTitleId,
      assertion: clip(`Credited name ${input.candidate.matchedName} in ${input.candidate.titleOfWork}.`, 320),
      evidenceType: "credit",
      reviewStatus: "unreviewed",
      capturedAt: now,
      displayAllowed: false,
      linkAllowed: false,
      createdAt: now
    })
  ];

  const base = {
    provisional: false,
    rewritesPublishedSlug: false as const,
    identity,
    works,
    appearances,
    evidence,
    relatedIdentityIds,
    publishedCitations: citations
  };

  if (existingIdentity && appearances.length === 0) {
    return {
      ...base,
      disposition: "duplicate",
      reason: `This credit is already recorded as identity ${existingIdentity.id}. No second identity was created.`,
      identity: existingIdentity,
      works: [],
      appearances: [],
      evidence: []
    };
  }

  if (needsEvidence(input.candidate)) {
    return {
      ...base,
      disposition: "needs_evidence",
      provisional: true,
      reason:
        input.candidate.payload.sourceType === "self_credit"
          ? "Self credit matches a Steve-family given name only. It stays a provisional person record until on-screen evidence is reviewed."
          : "The match confidence is too low to open a verified identity."
    };
  }

  if (existingIdentity) {
    return {
      ...base,
      disposition: "new_appearance",
      reason: `Additional appearance of identity ${existingIdentity.id}. The character was not merged into a different name or a published slug.`
    };
  }

  const collisionNote =
    relatedIdentityIds.length > 0
      ? " Another identity uses the same credited name and stays separate."
      : "";

  return {
    ...base,
    disposition: "new_identity",
    reason: `New identity for ${input.candidate.matchedName} in ${input.candidate.titleOfWork}. Same display names are not merged.${collisionNote}`
  };
}

export function commitIdentityPlan(registry: IdentityRegistry, plan: IdentityPlan): IdentityRegistry {
  if (plan.disposition !== "new_identity" && plan.disposition !== "new_appearance") {
    return registry;
  }

  if (!plan.identity) {
    return registry;
  }

  const identityIds = new Set(registry.identities.map((identity) => identity.id));
  const workIds = new Set(registry.works.map((work) => work.id));
  const appearanceIds = new Set(registry.appearances.map((appearance) => appearance.dedupeKey));

  return {
    identities: identityIds.has(plan.identity.id) ? registry.identities : [...registry.identities, plan.identity],
    works: [...registry.works, ...plan.works.filter((work) => !workIds.has(work.id))],
    appearances: [...registry.appearances, ...plan.appearances.filter((appearance) => !appearanceIds.has(appearance.dedupeKey))]
  };
}

export function appendReviewAction(log: readonly ReviewAction[], action: ReviewAction): ReviewAction[] {
  const parsed = reviewActionSchema.parse(action);

  if (log.some((existing) => existing.id === parsed.id)) {
    throw new Error(`Review action ${parsed.id} already exists and cannot be rewritten.`);
  }

  return [...log, parsed];
}

export function markCandidateReview(input: {
  candidate: CandidateEntry;
  disposition: ReviewDisposition;
  moderator: string;
  reason: string;
  actionId: string;
  createdAt: string;
  log?: readonly ReviewAction[];
  identityId?: string;
}): { candidate: CandidateEntry; log: ReviewAction[] } {
  const action = reviewActionSchema.parse({
    id: input.actionId,
    action: input.disposition === "duplicate" || input.disposition === "out_of_scope" ? "reject" : "create",
    moderator: input.moderator,
    reason: input.reason,
    targetType: "candidate",
    targetId: input.candidate.id,
    beforePayload: {
      slug: input.candidate.slug,
      status: input.candidate.status,
      reviewDisposition: input.candidate.reviewDisposition ?? null
    },
    afterPayload: {
      slug: input.candidate.slug,
      status: input.candidate.status,
      reviewDisposition: input.disposition
    },
    createdAt: input.createdAt
  });

  return {
    candidate: {
      ...input.candidate,
      reviewDisposition: input.disposition,
      identityId: input.identityId ?? input.candidate.identityId,
      updatedAt: input.createdAt
    },
    log: appendReviewAction(input.log ?? [], action)
  };
}

export function suggestCandidateReviews(
  candidates: readonly CandidateEntry[],
  publishedEntries: readonly PublishedEntryRef[] = []
) {
  let registry = emptyIdentityRegistry();

  return candidates.map((candidate) => {
    const plan = resolveCandidateIdentity({ candidate, registry, publishedEntries });

    if (plan.disposition === "new_identity" || plan.disposition === "new_appearance") {
      registry = commitIdentityPlan(registry, plan);
    }

    const disposition = candidate.reviewDisposition ?? plan.disposition;

    return {
      candidate,
      disposition,
      reason: candidate.reviewDisposition
        ? "Saved review disposition. A later ingest does not replace it."
        : plan.reason,
      saved: Boolean(candidate.reviewDisposition)
    };
  });
}
