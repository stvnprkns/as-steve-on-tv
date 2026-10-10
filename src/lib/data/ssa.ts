import { createHash } from "node:crypto";
import path from "node:path";

import { readZip } from "@/src/lib/data/zip-archive";
import {
  birthNameCountSchema,
  STUDY_WINDOW_END,
  STUDY_WINDOW_START,
  type BirthNameCount,
  type StudySex
} from "@/src/lib/schema";
import { sourceSnapshotSchema, type SourceSnapshot } from "@/src/lib/schema";

export const SSA_SCRIPT_VERSION = "data-ssa-v1";
export const SSA_SOURCE_URL = "https://www.ssa.gov/oact/babynames/names.zip";
export const SSA_MINIMUM_REPORTED_COUNT = 5;

/** Spellings stay separate. Controls stay in the study and out of the public index. */
export const SSA_TRACKED_NAMES = ["Steve", "Steven", "Stephen", "Stevie", "John", "David", "Michael", "Robert"] as const;

const TRACKED_NAME_KEYS = new Set(SSA_TRACKED_NAMES.map((name) => name.toLowerCase()));
const YOB_FILE = /^yob(\d{4})\.txt$/i;

export type SsaTextFile = {
  name: string;
  text: string;
};

export type SsaImportOptions = {
  releaseDate: string;
  retrievedAt: string;
  contentSha256: string;
  sourceUrl?: string;
};

export type SsaImport = {
  snapshot: SourceSnapshot;
  observations: BirthNameCount[];
};

type ParsedCell = {
  name: string;
  sex: StudySex;
  birthYear: number;
  count: number;
};

export function assertSsaReleaseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("SSA --release-date must be YYYY-MM-DD.");
  }

  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const valid =
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;

  if (!valid) {
    throw new Error("SSA --release-date must be a real calendar date.");
  }
}

export function checksumBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function checksumTextFiles(files: readonly SsaTextFile[]): string {
  const hash = createHash("sha256");

  for (const file of [...files].sort((left, right) => left.name.localeCompare(right.name))) {
    hash.update(file.name);
    hash.update("\0");
    hash.update(file.text);
    hash.update("\0");
  }

  return hash.digest("hex");
}

export function studyWindowYears(): number[] {
  const years: number[] = [];

  for (let year = STUDY_WINDOW_START; year <= STUDY_WINDOW_END; year += 1) {
    years.push(year);
  }

  return years;
}

export function isStudyWindowYear(year: number): boolean {
  return year >= STUDY_WINDOW_START && year <= STUDY_WINDOW_END;
}

export function observationsInStudyWindow(observations: readonly BirthNameCount[]): BirthNameCount[] {
  return observations.filter((row) => isStudyWindowYear(row.birthYear));
}

/** A missing or suppressed cell is never a numeric zero. */
export function observeBirthName(
  observations: readonly BirthNameCount[],
  name: string,
  sex: StudySex,
  birthYear: number
): BirthNameCount | undefined {
  const key = name.toLowerCase();
  return observations.find((row) => row.name.toLowerCase() === key && row.sex === sex && row.birthYear === birthYear);
}

export function parseSsaLine(line: string): { name: string; sex: StudySex; count: number } | null {
  const trimmed = line.replace(/^\uFEFF/, "").trim();

  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(",");

  if (parts.length < 3) {
    return null;
  }

  const countRaw = parts[parts.length - 1]?.trim() ?? "";
  const sexRaw = parts[parts.length - 2]?.trim() ?? "";
  const name = parts.slice(0, -2).join(",").trim();

  if (!name || (sexRaw !== "F" && sexRaw !== "M") || !/^\d+$/.test(countRaw)) {
    return null;
  }

  return { name, sex: sexRaw, count: Number.parseInt(countRaw, 10) };
}

export function parseSsaTexts(files: readonly SsaTextFile[], options: SsaImportOptions): SsaImport {
  assertSsaReleaseDate(options.releaseDate);
  const cells: ParsedCell[] = [];
  let invalidRows = 0;
  let yobFiles = 0;

  for (const file of files) {
    const base = path.posix.basename(file.name.replace(/\\/g, "/"));
    const match = YOB_FILE.exec(base);

    if (!match) {
      continue;
    }

    yobFiles += 1;
    const birthYear = Number.parseInt(match[1], 10);

    for (const line of file.text.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }

      const parsed = parseSsaLine(line);

      if (!parsed) {
        invalidRows += 1;
        continue;
      }

      cells.push({ ...parsed, birthYear });
    }
  }

  if (yobFiles === 0) {
    throw new Error("SSA import found no yobYYYY.txt files.");
  }

  const resolved = resolveCells(cells);
  const observations = materializeObservations(resolved.rows, options);
  const beyondFrozenCutoff = observations.filter((row) => row.birthYear > STUDY_WINDOW_END).length;
  const reported = observations.filter((row) => row.observationState === "reported").length;
  const suppressedOrAbsent = observations.filter((row) => row.observationState === "suppressed_or_absent").length;

  if (observations.some((row) => row.count === 0)) {
    throw new Error("SSA import produced a numeric zero. Suppressed and absent cells must stay null.");
  }

  const snapshot = sourceSnapshotSchema.parse({
    id: snapshotId(options.contentSha256, options.releaseDate),
    sourceName: "ssa-national-baby-names",
    versionLabel: options.releaseDate,
    retrievedAt: options.retrievedAt,
    contentSha256: options.contentSha256,
    sourceUrl: options.sourceUrl ?? SSA_SOURCE_URL,
    licenseClassification: "us-government-work",
    importedRowCounts: {
      files: yobFiles,
      reported,
      suppressedOrAbsent,
      invalidRows,
      duplicateRows: resolved.duplicateRows,
      beyondFrozenCutoff
    },
    scriptVersion: SSA_SCRIPT_VERSION,
    createdAt: options.retrievedAt
  });

  return { snapshot, observations };
}

export function parseSsaZip(buffer: Buffer, options: Omit<SsaImportOptions, "contentSha256">): SsaImport {
  const files = readZip(buffer).map((entry) => ({
    name: entry.name,
    text: entry.bytes.toString("utf8")
  }));

  return parseSsaTexts(files, { ...options, contentSha256: checksumBytes(buffer) });
}

function snapshotId(contentSha256: string, releaseDate: string): string {
  const digest = createHash("sha256").update(`${contentSha256}\0${releaseDate}`).digest("hex").slice(0, 24);
  return `snapshot-ssa-${digest}`;
}

function observationId(snapshot: string, name: string, sex: StudySex, birthYear: number): string {
  const digest = createHash("sha256")
    .update([snapshot, name.toLowerCase(), sex, String(birthYear)].join("\0"))
    .digest("hex")
    .slice(0, 24);

  return `birth-${digest}`;
}

function resolveCells(cells: readonly ParsedCell[]): { rows: ParsedCell[]; duplicateRows: number } {
  const grouped = new Map<string, ParsedCell[]>();

  for (const cell of cells) {
    const key = `${cell.birthYear}\0${cell.sex}\0${cell.name.toLowerCase()}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(cell);
    grouped.set(key, bucket);
  }

  const rows: ParsedCell[] = [];
  let duplicateRows = 0;

  for (const bucket of grouped.values()) {
    const sorted = [...bucket].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
    rows.push(sorted[0]);
    duplicateRows += bucket.length - 1;
  }

  return { rows, duplicateRows };
}

function materializeObservations(rows: readonly ParsedCell[], options: SsaImportOptions): BirthNameCount[] {
  const snapshot = snapshotId(options.contentSha256, options.releaseDate);
  const present = new Set<string>();
  const observations: BirthNameCount[] = [];

  for (const row of rows) {
    const key = cellKey(row.birthYear, row.sex, row.name);
    present.add(key);
    const suppressed = row.count < SSA_MINIMUM_REPORTED_COUNT;
    observations.push(
      birthNameCountSchema.parse({
        id: observationId(snapshot, row.name, row.sex, row.birthYear),
        name: row.name,
        sex: row.sex,
        birthYear: row.birthYear,
        count: suppressed ? null : row.count,
        observationState: suppressed ? "suppressed_or_absent" : "reported",
        sourceSnapshotId: snapshot
      })
    );
  }

  for (const birthYear of studyWindowYears()) {
    for (const name of SSA_TRACKED_NAMES) {
      for (const sex of ["F", "M"] as const) {
        if (present.has(cellKey(birthYear, sex, name))) {
          continue;
        }

        observations.push(
          birthNameCountSchema.parse({
            id: observationId(snapshot, name, sex, birthYear),
            name,
            sex,
            birthYear,
            count: null,
            observationState: "suppressed_or_absent",
            sourceSnapshotId: snapshot
          })
        );
      }
    }
  }

  return observations.sort(compareObservations);
}

function cellKey(birthYear: number, sex: StudySex, name: string): string {
  return `${birthYear}\0${sex}\0${name.toLowerCase()}`;
}

function compareObservations(left: BirthNameCount, right: BirthNameCount): number {
  return (
    left.birthYear - right.birthYear ||
    left.sex.localeCompare(right.sex) ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

export function trackedStudyName(name: string): boolean {
  return TRACKED_NAME_KEYS.has(name.toLowerCase());
}

export function ssaSummaryLines(result: SsaImport): string[] {
  const reported = result.observations.filter((row) => row.observationState === "reported").length;
  const suppressedOrAbsent = result.observations.filter((row) => row.observationState === "suppressed_or_absent").length;
  const zeros = result.observations.filter((row) => row.count === 0).length;
  const beyond = result.observations.filter((row) => row.birthYear > STUDY_WINDOW_END).length;

  return [
    `sha256: ${result.snapshot.contentSha256}`,
    `release date: ${result.snapshot.versionLabel}`,
    `yob files: ${result.snapshot.importedRowCounts.files}`,
    `reported rows: ${reported}`,
    `suppressed or absent rows: ${suppressedOrAbsent}`,
    `numeric zero counts: ${zeros}`,
    `rows after 2025 left out of the study window: ${beyond}`,
    `study window rows: ${observationsInStudyWindow(result.observations).length}`
  ];
}
