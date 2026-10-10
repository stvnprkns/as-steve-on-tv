import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import { getContentRepository } from "../src/lib/content/repository";
import {
  createImdbDiscovery,
  parseEpisodeLine,
  parseNameBasicsLine,
  parsePrincipalLine,
  parseTitleBasicsLine,
  type DiscoveryResult,
  type ImdbEpisodeRow,
  type ImdbNameRow,
  type ImdbTitleRow
} from "../src/lib/data/normalize-character";
import type { IngestRun } from "../src/lib/schema";

const MISSING_IMDB_BULK_DIR_ERROR =
  "Set IMDB_BULK_DIR to a directory containing title.basics.tsv, title.principals.tsv, and name.basics.tsv.";

const TITLE_BASICS_HEADER = "tconst\ttitleType\tprimaryTitle";
const NAME_BASICS_HEADER = "nconst\tprimaryName";
const PRINCIPALS_HEADER = "tconst\tordering\tnconst\tcategory\tjob\tcharacters";
const EPISODE_HEADER = "tconst\tparentTconst";

function nowIso() {
  return new Date().toISOString();
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertHeader(header: string, expectedPrefix: string, label: string) {
  if (!header.startsWith(expectedPrefix)) {
    throw new Error(`Unexpected ${label} header. Expected columns starting with ${expectedPrefix}.`);
  }
}

async function forEachTsvRow(
  filePath: string,
  onHeader: (header: string) => void,
  onRow: (line: string) => void
) {
  const stream = createReadStream(filePath, "utf8");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) {
      onHeader(line.replace(/^\uFEFF/, ""));
      isHeader = false;
      continue;
    }

    if (line.trim()) {
      onRow(line);
    }
  }
}

function printReport(result: DiscoveryResult, mode: "dry-run" | "written", episodeFile: "used" | "absent") {
  const heading = mode === "dry-run" ? "IMDb ingest dry run complete." : "IMDb ingest completed.";
  console.log(heading);
  console.log(`- records scanned: ${result.counts.recordsScanned}`);
  console.log(`- source titles: ${result.sourceTitles.length}`);
  console.log(`- source people: ${result.sourcePeople.length}`);
  console.log(`- candidates: ${result.candidates.length}`);
  console.log(`- unresolved titles: ${result.unresolved.length}`);
  console.log(`- title.episode.tsv: ${episodeFile}`);
  console.log(`- skipped non-performer credits: ${result.counts.skippedNonPerformer}`);
  console.log(`- skipped unmatched credits: ${result.counts.skippedUnmatchedCredit}`);

  const samples = result.unresolved.slice(0, 25);

  if (samples.length > 0) {
    console.log("- unresolved samples:");

    for (const sample of samples) {
      console.log(`  - ${sample.tconst}\t${sample.titleType}\t${sample.primaryTitle}\t${sample.reason}`);
    }
  }

  console.log(`- first candidate: ${result.candidates[0]?.displayName ?? "none"}`);
}

async function main() {
  const datasetDir = process.env.IMDB_BULK_DIR;

  if (!datasetDir) {
    throw new Error(MISSING_IMDB_BULK_DIR_ERROR);
  }

  const startedAt = nowIso();
  const dryRun = process.argv.includes("--dry-run") || !process.env.DATABASE_URL;
  const titleBasicsPath = path.join(datasetDir, "title.basics.tsv");
  const titlePrincipalsPath = path.join(datasetDir, "title.principals.tsv");
  const nameBasicsPath = path.join(datasetDir, "name.basics.tsv");
  const titleEpisodePath = path.join(datasetDir, "title.episode.tsv");

  for (const requiredPath of [titleBasicsPath, titlePrincipalsPath, nameBasicsPath]) {
    if (!(await fileExists(requiredPath))) {
      throw new Error(`Missing required IMDb bulk file: ${requiredPath}`);
    }
  }

  // Titles, names, and episodes are still loaded into memory. A disk-backed pass
  // is the next discovery limit and is intentionally not built in this phase.
  const titles: ImdbTitleRow[] = [];
  const names: ImdbNameRow[] = [];
  const episodes: ImdbEpisodeRow[] = [];

  await forEachTsvRow(
    titleBasicsPath,
    (header) => assertHeader(header, TITLE_BASICS_HEADER, "title.basics.tsv"),
    (line) => {
      const row = parseTitleBasicsLine(line);

      if (row) {
        titles.push(row);
      }
    }
  );

  await forEachTsvRow(
    nameBasicsPath,
    (header) => assertHeader(header, NAME_BASICS_HEADER, "name.basics.tsv"),
    (line) => {
      const row = parseNameBasicsLine(line);

      if (row) {
        names.push(row);
      }
    }
  );

  let episodeFile: "used" | "absent" = "absent";

  if (await fileExists(titleEpisodePath)) {
    episodeFile = "used";
    await forEachTsvRow(
      titleEpisodePath,
      (header) => assertHeader(header, EPISODE_HEADER, "title.episode.tsv"),
      (line) => {
        const row = parseEpisodeLine(line);

        if (row) {
          episodes.push(row);
        }
      }
    );
  }

  const discovery = createImdbDiscovery({ titles, names, episodes });

  await forEachTsvRow(
    titlePrincipalsPath,
    (header) => assertHeader(header, PRINCIPALS_HEADER, "title.principals.tsv"),
    (line) => {
      const row = parsePrincipalLine(line);

      if (row) {
        discovery.observePrincipal(row);
      }
    }
  );

  const result = discovery.finish();

  if (dryRun) {
    printReport(result, "dry-run", episodeFile);
    return;
  }

  const completedAt = nowIso();
  const repository = getContentRepository();
  const ingestRun: IngestRun = {
    id: `ingest-run-imdb-bulk-${completedAt.slice(0, 10)}`,
    provider: "imdb_bulk",
    status: "completed",
    recordsScanned: result.counts.recordsScanned,
    candidatesCreated: result.candidates.length,
    notes: `Phase 1 IMDb discovery. Character credits and qualifying self credits only. Unresolved titles: ${result.unresolved.length}. Shorts, videos, and video games are not commercials.`,
    startedAt,
    completedAt,
    createdAt: startedAt,
    updatedAt: completedAt
  };

  await repository.upsertSourceTitles(result.sourceTitles);
  await repository.upsertSourcePeople(result.sourcePeople);
  await repository.upsertCandidates(result.candidates);
  await repository.upsertIngestRun(ingestRun);
  printReport(result, "written", episodeFile);
}

const entry = process.argv[1] ?? "";

if (entry.includes("ingest-imdb-bulk")) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("IMDb ingest failed.");
    console.error(message);
    process.exit(1);
  });
}
