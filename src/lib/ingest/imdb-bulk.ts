import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import { hasDatabaseUrl } from "@/src/lib/db/pg";
import { getContentRepository } from "@/src/lib/content/repository";
import type { CandidateEntry, IngestRun, NameVariant, SourcePersonRecord, SourceTitleRecord, SteveEntry } from "@/src/lib/schema";

type TitleBasics = {
  tconst: string;
  titleType: string;
  primaryTitle: string;
  startYear: number;
  endYear?: number;
};

type NameBasics = {
  nconst: string;
  primaryName: string;
};

type IngestSummary = {
  skipped: boolean;
  datasetFingerprint: string;
  recordsScanned: number;
  sourceTitles: number;
  sourcePeople: number;
  candidatesCreated: number;
  candidatesUpdated: number;
  candidatesMerged: number;
  candidatesSkipped: number;
  firstCandidate?: string;
};

const steveMatchers = [
  { variant: "steve", pattern: /\bsteve\b/i },
  { variant: "stephen", pattern: /\bstephen\b/i },
  { variant: "steven", pattern: /\bsteven\b/i },
  { variant: "stevie", pattern: /\bstevie\b/i }
] as const;

function nowIso() {
  return new Date().toISOString();
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function parseLine(line: string) {
  return line.split("\t");
}

function normalizeMedium(titleType: string): "tv" | "film" | "commercial" {
  if (titleType.includes("tv")) {
    return "tv";
  }

  if (titleType.includes("short") || titleType.includes("video")) {
    return "commercial";
  }

  return "film";
}

function detectSteveName(value: string) {
  const clean = value.replace(/[\[\]"]/g, " ").trim();

  for (const matcher of steveMatchers) {
    if (matcher.pattern.test(clean)) {
      return {
        variant: matcher.variant as NameVariant,
        matchedName: clean
      };
    }
  }

  return null;
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getDatasetFingerprint(filePaths: string[]) {
  const parts = await Promise.all(
    filePaths.map(async (filePath) => {
      const fileStat = await stat(filePath);
      return `${path.basename(filePath)}:${fileStat.size}:${Math.trunc(fileStat.mtimeMs)}`;
    })
  );

  return createHash("sha1").update(parts.sort().join("|")).digest("hex");
}

async function loadTitleBasics(filePath: string) {
  const titles = new Map<string, TitleBasics>();
  const stream = createReadStream(filePath, "utf8");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }

    const [tconst, titleType, primaryTitle, , , startYear, endYear] = parseLine(line);
    const parsedStartYear = Number.parseInt(startYear, 10);

    if (!tconst || !primaryTitle || Number.isNaN(parsedStartYear)) {
      continue;
    }

    titles.set(tconst, {
      tconst,
      titleType,
      primaryTitle,
      startYear: parsedStartYear,
      endYear: Number.isNaN(Number.parseInt(endYear, 10)) ? undefined : Number.parseInt(endYear, 10)
    });
  }

  return titles;
}

async function loadNameBasics(filePath: string) {
  const names = new Map<string, NameBasics>();
  const stream = createReadStream(filePath, "utf8");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }

    const [nconst, primaryName] = parseLine(line);

    if (!nconst || !primaryName) {
      continue;
    }

    names.set(nconst, { nconst, primaryName });
  }

  return names;
}

function getCandidateStableId({
  imdbTitleId,
  imdbNameId,
  matchedName,
  variant
}: {
  imdbTitleId: string;
  imdbNameId: string;
  matchedName: string;
  variant: NameVariant;
}) {
  const detectionKey = `${imdbTitleId}:${imdbNameId}:${variant}:${matchedName.toLowerCase()}`;
  const digest = createHash("sha1").update(detectionKey).digest("hex").slice(0, 16);

  return {
    detectionKey,
    candidateId: `candidate-${digest}`
  };
}

function getEntryMatchByExternalRefs(
  entry: {
    slug: string;
    externalRefs?: SteveEntry["externalRefs"];
  },
  entries: SteveEntry[]
) {
  return (
    entries.find(
      (candidate) =>
        (entry.externalRefs?.imdbTitleId && candidate.externalRefs?.imdbTitleId === entry.externalRefs.imdbTitleId) &&
        (!entry.externalRefs?.imdbNameId || candidate.externalRefs?.imdbNameId === entry.externalRefs.imdbNameId)
    ) ??
    entries.find((candidate) => candidate.slug === entry.slug) ??
    null
  );
}

export async function runImdbBulkIngest({ skipIfUnchanged = true }: { skipIfUnchanged?: boolean } = {}) {
  const datasetDir = process.env.IMDB_BULK_DIR;

  if (!datasetDir) {
    throw new Error("Set IMDB_BULK_DIR to a directory containing title.basics.tsv, title.principals.tsv, and name.basics.tsv.");
  }

  const titleBasicsPath = path.join(datasetDir, "title.basics.tsv");
  const titlePrincipalsPath = path.join(datasetDir, "title.principals.tsv");
  const nameBasicsPath = path.join(datasetDir, "name.basics.tsv");
  const filePaths = [titleBasicsPath, titlePrincipalsPath, nameBasicsPath];

  for (const requiredPath of filePaths) {
    if (!(await fileExists(requiredPath))) {
      throw new Error(`Missing required IMDb bulk file: ${requiredPath}`);
    }
  }

  const repository = getContentRepository();
  const [titles, names, existingCandidates, existingEntries, previousRuns] = await Promise.all([
    loadTitleBasics(titleBasicsPath),
    loadNameBasics(nameBasicsPath),
    repository.listReviewQueue(),
    repository.listEntries(),
    repository.listIngestRuns()
  ]);
  const datasetFingerprint = await getDatasetFingerprint(filePaths);
  const previousFingerprint = previousRuns.find((run) => run.provider === "imdb_bulk" && run.status === "completed")?.datasetFingerprint;

  if (skipIfUnchanged && previousFingerprint === datasetFingerprint) {
    return {
      skipped: true,
      datasetFingerprint,
      recordsScanned: 0,
      sourceTitles: 0,
      sourcePeople: 0,
      candidatesCreated: 0,
      candidatesUpdated: 0,
      candidatesMerged: 0,
      candidatesSkipped: 0
    } satisfies IngestSummary;
  }

  const sourceTitles = new Map<string, SourceTitleRecord>();
  const sourcePeople = new Map<string, SourcePersonRecord>();
  const candidates = new Map<string, CandidateEntry>();
  let recordsScanned = 0;
  let candidatesCreated = 0;
  let candidatesUpdated = 0;
  let candidatesMerged = 0;
  let candidatesSkipped = 0;
  const startedAt = nowIso();
  const existingCandidateMap = new Map(existingCandidates.map((candidate) => [candidate.id, candidate]));

  const principalsStream = createReadStream(titlePrincipalsPath, "utf8");
  const rl = readline.createInterface({ input: principalsStream, crlfDelay: Infinity });
  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }

    recordsScanned += 1;
    const [tconst, , nconst, category, , job, characters] = parseLine(line);
    const title = titles.get(tconst);
    const person = names.get(nconst);

    if (!title || !person) {
      continue;
    }

    const match = detectSteveName(characters || job || person.primaryName);

    if (!match) {
      continue;
    }

    const medium = normalizeMedium(title.titleType);
    const fetchedAt = nowIso();
    const sourceTitleId = `source-title-${tconst}`;
    const sourcePersonId = `source-person-${nconst}`;
    const slug = toSlug(`${match.matchedName}-${title.primaryTitle}`);
    const { candidateId, detectionKey } = getCandidateStableId({
      imdbTitleId: tconst,
      imdbNameId: nconst,
      matchedName: match.matchedName,
      variant: match.variant
    });
    const draftEntry: Partial<SteveEntry> = {
      displayName: match.matchedName,
      canonicalName: match.matchedName,
      nameVariant: match.variant,
      medium,
      titleOfWork: title.primaryTitle,
      actorOrPerson: person.primaryName,
      yearStart: title.startYear,
      yearEnd: title.endYear,
      entryType: category === "self" ? "person" : "character",
      externalRefs: {
        imdbTitleId: tconst,
        imdbNameId: nconst
      },
      fieldSources: {
        displayName: "imdb_bulk",
        titleOfWork: "imdb_bulk",
        actorOrPerson: "imdb_bulk",
        medium: "imdb_bulk",
        yearStart: "imdb_bulk",
        yearEnd: title.endYear ? "imdb_bulk" : undefined
      }
    };
    const linkedPublishedEntry = getEntryMatchByExternalRefs({ slug, externalRefs: draftEntry.externalRefs }, existingEntries);

    sourceTitles.set(sourceTitleId, {
      id: sourceTitleId,
      provider: "imdb_bulk",
      providerTitleId: tconst,
      imdbTitleId: tconst,
      title: title.primaryTitle,
      medium,
      yearStart: title.startYear,
      yearEnd: title.endYear,
      rawPayloadHash: createHash("sha1").update(`${tconst}:${title.primaryTitle}:${title.startYear}`).digest("hex"),
      payload: {
        tconst,
        titleType: title.titleType,
        primaryTitle: title.primaryTitle
      },
      fetchedAt,
      createdAt: fetchedAt,
      updatedAt: fetchedAt
    });

    sourcePeople.set(sourcePersonId, {
      id: sourcePersonId,
      provider: "imdb_bulk",
      providerPersonId: nconst,
      imdbNameId: nconst,
      displayName: person.primaryName,
      rawPayloadHash: createHash("sha1").update(`${nconst}:${person.primaryName}`).digest("hex"),
      payload: {
        nconst,
        primaryName: person.primaryName,
        category
      },
      fetchedAt,
      createdAt: fetchedAt,
      updatedAt: fetchedAt
    });

    const nextCandidate: CandidateEntry = {
      id: candidateId,
      slug,
      displayName: match.matchedName,
      canonicalName: match.matchedName,
      matchedName: match.matchedName,
      nameVariant: match.variant,
      entryType: category === "self" ? "person" : "character",
      medium,
      titleOfWork: title.primaryTitle,
      actorOrPerson: person.primaryName,
      yearStart: title.startYear,
      yearEnd: title.endYear,
      matchConfidence: characters ? "high" : "medium",
      matchReason: characters
        ? "Exact Steve-family name found in IMDb principal character data."
        : "Steve-family match inferred from credited name or job field.",
      status: linkedPublishedEntry ? "merged" : "pending_review",
      imdbTitleId: tconst,
      imdbNameId: nconst,
      sourceTitleId,
      sourcePersonId,
      linkedPublishedEntryId: linkedPublishedEntry?.id ?? null,
      payload: {
        ...draftEntry,
        derivedFromCandidateId: candidateId
      },
      notesOnUncertainty: characters ? undefined : "Auto-detected from non-character metadata. Review before publication.",
      evidenceLabels: ["IMDb bulk principal credit match", detectionKey],
      createdAt: fetchedAt,
      updatedAt: fetchedAt
    };

    const existingCandidate = existingCandidateMap.get(candidateId);

    if (!existingCandidate) {
      candidatesCreated += 1;
    } else if (JSON.stringify(existingCandidate) === JSON.stringify(nextCandidate)) {
      candidatesSkipped += 1;
      continue;
    } else {
      candidatesUpdated += 1;
    }

    if (linkedPublishedEntry) {
      candidatesMerged += 1;
    }

    candidates.set(candidateId, nextCandidate);
  }

  const completedAt = nowIso();
  const ingestRun: IngestRun = {
    id: `ingest-run-imdb-bulk-${completedAt.slice(0, 10)}-${datasetFingerprint.slice(0, 8)}`,
    provider: "imdb_bulk",
    status: "completed",
    datasetFingerprint,
    recordsScanned,
    candidatesCreated,
    candidatesUpdated,
    candidatesMerged,
    candidatesSkipped,
    notes: "Automated IMDb bulk ingest with checkpointing, dedupe, and published-entry matching.",
    startedAt,
    completedAt,
    createdAt: startedAt,
    updatedAt: completedAt
  };

  if (!hasDatabaseUrl()) {
    return {
      skipped: false,
      datasetFingerprint,
      recordsScanned,
      sourceTitles: sourceTitles.size,
      sourcePeople: sourcePeople.size,
      candidatesCreated,
      candidatesUpdated,
      candidatesMerged,
      candidatesSkipped,
      firstCandidate: candidates.values().next().value?.displayName
    } satisfies IngestSummary;
  }

  await repository.upsertSourceTitles([...sourceTitles.values()]);
  await repository.upsertSourcePeople([...sourcePeople.values()]);
  await repository.upsertCandidates([...candidates.values()]);
  await repository.upsertIngestRun(ingestRun);

  return {
    skipped: false,
    datasetFingerprint,
    recordsScanned,
    sourceTitles: sourceTitles.size,
    sourcePeople: sourcePeople.size,
    candidatesCreated,
    candidatesUpdated,
    candidatesMerged,
    candidatesSkipped,
    firstCandidate: candidates.values().next().value?.displayName
  } satisfies IngestSummary;
}
