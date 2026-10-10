import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { ANALYSIS_PROTOCOL, STUDY_EXPORT_FILES, readStudyExport, type QaReport, type StudyMetadata } from "@/src/lib/data/study-analysis";
import {
  storySummarySchema,
  type BirthNameShare,
  type StorySummary,
  type StudyLagScan,
  type StudyMetric,
  type StudyPanel
} from "@/src/lib/schema";

export const PUBLIC_STUDY_SLUG = "where-have-all-the-steves-gone";
export const STORY_SUMMARY_FILE = "story-summary.json";

const CONTROL_LABELS = ["john", "david", "michael", "robert"] as const;
const BANNED_CONCLUSION = [/steve is disappearing/i, /steve is thriving/i, /extinction is confirmed/i, /the extinction thesis is true/i];

export type RatePoint = {
  decade: number;
  medium: StudyPanel;
  variant: string;
  numerator: number | null;
  denominator: number | null;
  rate: number | null;
  uncertaintyLow: number | null;
  uncertaintyHigh: number | null;
  flags: string[];
};

export type BirthPoint = {
  year: number;
  numerator: number | null;
  denominator: number | null;
  rate: number | null;
  observationState: BirthNameShare["observationState"];
};

export type LagPoint = {
  lagYears: number;
  medium: StudyPanel;
  pairedDecades: number;
  correlation: number | null;
  status: StudyLagScan["status"];
  selected: false;
};

type StoryBase = {
  title: string;
  question: string;
  conclusion: null;
  methodology: string[];
  indexNote: string;
  commercialNote: string;
};

export type StoryView =
  | (StoryBase & { status: "in_progress" })
  | (StoryBase & {
      status: "published";
      summary: StorySummary;
      primary: RatePoint[];
      controls: RatePoint[];
      births: BirthPoint[];
      lags: LagPoint[];
      populationsDiffer: string;
    });

export function publicStudyDirectory(repoRoot = process.cwd()): string {
  return path.join(repoRoot, "content", "public", "studies", PUBLIC_STUDY_SLUG);
}

export function inProgressStory(): StoryView {
  return {
    status: "in_progress",
    ...storyCopy()
  };
}

export async function loadStudyStory(directory: string): Promise<StoryView> {
  try {
    const names = await readdir(directory);
    const allowed = new Set<string>([...STUDY_EXPORT_FILES, STORY_SUMMARY_FILE]);

    if (STUDY_EXPORT_FILES.some((name) => !names.includes(name)) || names.some((name) => !allowed.has(name))) {
      return inProgressStory();
    }

    const files = await readNamedFiles(directory, STUDY_EXPORT_FILES);
    const parsed = readStudyExport(files);

    if (!parsed.qa.passed || parsed.metadata.publicIndexIncluded !== false || parsed.metadata.commercialPrevalenceCalculated !== false) {
      return inProgressStory();
    }

    const summary = buildStorySummary(parsed);

    if (names.includes(STORY_SUMMARY_FILE)) {
      const stored = storySummarySchema.parse(JSON.parse(await readFile(path.join(directory, STORY_SUMMARY_FILE), "utf8")));

      if (!sameSummary(stored, summary)) {
        return inProgressStory();
      }
    }

    return publishedStory(summary, parsed.screenMetrics, parsed.birthShares, parsed.lagScan);
  } catch {
    return inProgressStory();
  }
}

export function buildStorySummary(input: {
  metadata: StudyMetadata;
  screenMetrics: readonly StudyMetric[];
  birthShares: readonly BirthNameShare[];
  lagScan: readonly StudyLagScan[];
  qa: QaReport;
}): StorySummary {
  const primary = steveFamilyIntroductions(input.screenMetrics);
  const empty = primary.filter((point) => point.denominator === null).length;
  const reportedLags = input.lagScan.filter((row) => row.status === "reported").length;
  const suppressed = input.birthShares.filter((row) => row.observationState === "suppressed_or_absent").length;
  const partial = input.birthShares.filter((row) => row.observationState === "partial_suppression").length;
  const footnotes = [
    input.metadata.populationsDiffer,
    "Empty bins stay unpublished. A blank rate is not a zero.",
    `${empty} of ${primary.length} Steve-family introduction bins have no denominator.`,
    `${suppressed} birth cells are suppressed or absent. ${partial} birth cells are partial because a spelling is missing.`,
    `The lag scan has ${input.lagScan.length} windows and ${reportedLags} reported correlations. No lag is selected.`,
    "Commercial sightings stay off this chart. There is no ad denominator.",
    "John, David, Michael, and Robert remain control names. They are not archive entries.",
    input.qa.note
  ];

  if (footnotes.some((footnote) => BANNED_CONCLUSION.some((pattern) => pattern.test(footnote)))) {
    throw new Error("Story summary refused a prewritten extinction conclusion.");
  }

  return storySummarySchema.parse({
    studyId: input.metadata.studyId,
    calculationVersion: input.metadata.calculationVersion,
    sourceSnapshotId: input.metadata.sourceSnapshotId,
    window: { startYear: 1960, endYear: 2025 },
    conclusion: null,
    commercialPrevalenceCalculated: false,
    publicIndexIncluded: false,
    controlsArePublicEntries: false,
    populationsDiffer: input.metadata.populationsDiffer,
    primaryOutcome: "new_introductions_per_1000",
    primaryVariant: "steve_family",
    panels: primary.map((point) => ({
      medium: point.medium,
      decade: point.decade,
      numerator: point.numerator,
      denominator: point.denominator,
      rate: point.rate,
      uncertaintyLow: point.uncertaintyLow,
      uncertaintyHigh: point.uncertaintyHigh,
      flags: point.flags
    })),
    footnotes
  });
}

export async function prepareStudyPublication(sourceDir: string): Promise<{ files: Record<string, string>; summary: StorySummary }> {
  const names = await readdir(sourceDir);
  const files = await readNamedFiles(
    sourceDir,
    STUDY_EXPORT_FILES.filter((name) => names.includes(name))
  );
  const missing = STUDY_EXPORT_FILES.filter((name) => files[name] === undefined);

  if (missing.length > 0) {
    throw new Error(`Study export is missing ${missing.join(", ")}.`);
  }

  const parsed = readStudyExport(files);

  if (!parsed.qa.passed) {
    throw new Error("Study QA failed. Aggregates stay unpublished.");
  }

  return { files, summary: buildStorySummary(parsed) };
}

export async function publishStudyBundle(input: { sourceDir: string; destination: string }): Promise<StorySummary> {
  const prepared = await prepareStudyPublication(input.sourceDir);
  await mkdir(input.destination, { recursive: true });

  for (const name of STUDY_EXPORT_FILES) {
    const contents = prepared.files[name];

    if (contents === undefined) {
      throw new Error(`Study export is missing ${name}.`);
    }

    await writeFile(path.join(input.destination, name), contents);
  }

  await writeFile(path.join(input.destination, STORY_SUMMARY_FILE), `${JSON.stringify(prepared.summary, null, 2)}\n`);
  return prepared.summary;
}

function publishedStory(
  summary: StorySummary,
  screenMetrics: readonly StudyMetric[],
  birthShares: readonly BirthNameShare[],
  lagScan: readonly StudyLagScan[]
): StoryView {
  return {
    status: "published",
    ...storyCopy(),
    summary,
    primary: steveFamilyIntroductions(screenMetrics),
    controls: controlIntroductions(screenMetrics),
    births: birthTrajectory(birthShares),
    lags: lagScan.map((row) => ({
      lagYears: row.lagYears,
      medium: row.medium,
      pairedDecades: row.pairedDecades,
      correlation: row.correlation,
      status: row.status,
      selected: false
    })),
    populationsDiffer: summary.populationsDiffer
  };
}

function storyCopy(): StoryBase {
  return {
    title: "Where have all the Steves gone?",
    question: "Did new fictional Steves become rarer on screen after the name became less common at birth?",
    conclusion: null,
    methodology: [
      `The primary outcome is new fictional Steve-family introductions per 1,000 eligible new named characters, for ${ANALYSIS_PROTOCOL.window.startYear}–${ANALYSIS_PROTOCOL.window.endYear}.`,
      "Film and television are separate panels. A missing debut stays out of the introduction denominator. A denominator with no matches is a real zero, and a missing denominator stays blank.",
      "Spellings stay separate in the tables. The combined Steve-family group is Steve, Steven, Stephen, and Stevie.",
      "John, David, Michael, and Robert are control names inside the study. They are not archive entries.",
      "Uncertainty intervals resample works or series. The lag scan runs from 0 to 50 years at 5-year steps, and every window stays in the report.",
      "Birth shares use tabulated SSA names per 100,000. Screen rates use eligible fictional credits. The two populations stay labeled apart.",
      "The curated archive is linked from this page and is not a numerator or a denominator."
    ],
    indexNote: "The archive is a curated list of Steve sightings. This study does not count those entries as its sample.",
    commercialNote: "Commercial sightings stay off these charts. There is no representative ad denominator, so this page has no commercial prevalence line."
  };
}

function steveFamilyIntroductions(metrics: readonly StudyMetric[]): RatePoint[] {
  return metrics
    .filter((metric) => metric.metricKind === "new_introductions_per_1000" && metric.variantLabel === "steve_family")
    .map(ratePoint);
}

function controlIntroductions(metrics: readonly StudyMetric[]): RatePoint[] {
  return metrics
    .filter(
      (metric) =>
        metric.metricKind === "new_introductions_per_1000" &&
        (metric.variantLabel === "steve_family" || CONTROL_LABELS.includes(metric.variantLabel as (typeof CONTROL_LABELS)[number]))
    )
    .map(ratePoint);
}

function ratePoint(metric: StudyMetric): RatePoint {
  return {
    decade: metric.decade,
    medium: metric.medium,
    variant: metric.variantLabel,
    numerator: metric.numerator,
    denominator: metric.denominator,
    rate: metric.rate,
    uncertaintyLow: metric.uncertaintyLow,
    uncertaintyHigh: metric.uncertaintyHigh,
    flags: metric.completenessFlags
  };
}

function birthTrajectory(shares: readonly BirthNameShare[]): BirthPoint[] {
  return shares
    .filter((share) => share.variantLabel === "steve_family" && share.sex === "combined" && share.birthYear >= 1960)
    .map((share) => ({
      year: share.birthYear,
      numerator: share.numerator,
      denominator: share.denominator,
      rate: share.rate,
      observationState: share.observationState
    }));
}

function sameSummary(left: StorySummary, right: StorySummary): boolean {
  return JSON.stringify(left.panels) === JSON.stringify(right.panels) && left.studyId === right.studyId && left.conclusion === right.conclusion;
}

async function readNamedFiles(directory: string, names: readonly string[]): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  for (const name of names) {
    files[name] = await readFile(path.join(directory, name), "utf8");
  }

  return files;
}
