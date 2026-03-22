import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import { getContentRepository } from "../src/lib/content/repository";
import type { CandidateEntry, IngestRun, SourcePersonRecord, SourceTitleRecord } from "../src/lib/schema";

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
        variant: matcher.variant,
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

async function main() {
  const datasetDir = process.env.IMDB_BULK_DIR;

  if (!datasetDir) {
    throw new Error("Set IMDB_BULK_DIR to a directory containing title.basics.tsv, title.principals.tsv, and name.basics.tsv.");
  }

  const titleBasicsPath = path.join(datasetDir, "title.basics.tsv");
  const titlePrincipalsPath = path.join(datasetDir, "title.principals.tsv");
  const nameBasicsPath = path.join(datasetDir, "name.basics.tsv");

  for (const requiredPath of [titleBasicsPath, titlePrincipalsPath, nameBasicsPath]) {
    if (!(await fileExists(requiredPath))) {
      throw new Error(`Missing required IMDb bulk file: ${requiredPath}`);
    }
  }

  const [titles, names] = await Promise.all([loadTitleBasics(titleBasicsPath), loadNameBasics(nameBasicsPath)]);
  const repository = getContentRepository();

  const sourceTitles = new Map<string, SourceTitleRecord>();
  const sourcePeople = new Map<string, SourcePersonRecord>();
  const candidates = new Map<string, CandidateEntry>();
  let recordsScanned = 0;
  const startedAt = nowIso();

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
    const candidateId = `candidate-${slug}`;

    sourceTitles.set(
      sourceTitleId,
      {
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
      }
    );

    sourcePeople.set(
      sourcePersonId,
      {
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
      }
    );

    candidates.set(candidateId, {
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
      status: "pending_review",
      imdbTitleId: tconst,
      imdbNameId: nconst,
      sourceTitleId,
      sourcePersonId,
      linkedPublishedEntryId: null,
      payload: {
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
        }
      },
      evidenceLabels: ["IMDb bulk principal credit match"],
      createdAt: fetchedAt,
      updatedAt: fetchedAt
    });
  }

  const completedAt = nowIso();
  const ingestRun: IngestRun = {
    id: `ingest-run-imdb-bulk-${completedAt.slice(0, 10)}`,
    provider: "imdb_bulk",
    status: "completed",
    recordsScanned,
    candidatesCreated: candidates.size,
    notes: "Automated IMDb bulk ingest with Steve-family detection.",
    startedAt,
    completedAt,
    createdAt: startedAt,
    updatedAt: completedAt
  };

  if (!process.env.DATABASE_URL) {
    console.log("IMDb ingest dry run complete.");
    console.log(`- records scanned: ${recordsScanned}`);
    console.log(`- source titles: ${sourceTitles.size}`);
    console.log(`- source people: ${sourcePeople.size}`);
    console.log(`- candidates: ${candidates.size}`);
    console.log(`- first candidate: ${candidates.values().next().value?.displayName ?? "none"}`);
    return;
  }

  await repository.upsertSourceTitles([...sourceTitles.values()]);
  await repository.upsertSourcePeople([...sourcePeople.values()]);
  await repository.upsertCandidates([...candidates.values()]);
  await repository.upsertIngestRun(ingestRun);

  console.log("IMDb ingest completed.");
  console.log(`- records scanned: ${recordsScanned}`);
  console.log(`- candidates upserted: ${candidates.size}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("IMDb ingest failed.");
  console.error(message);
  process.exit(1);
});
