import { createHash } from "node:crypto";

import { buildBirthShares } from "@/src/lib/data/birth-shares";
import { pearson, roundMetric } from "@/src/lib/data/bootstrap";
import { runFeasibilityPilot } from "@/src/lib/data/coverage";
import { buildScreenMetrics, metricScale } from "@/src/lib/data/study-metrics";
import { studyDecades } from "@/src/lib/data/study-sample";
import {
  analysisProtocolSchema,
  birthNameShareSchema,
  studyLagScanSchema,
  studyMetricSchema,
  type AnalysisProtocol,
  type BirthNameCount,
  type BirthNameShare,
  type StudyCatalog,
  type StudyCharacterCredit,
  type StudyExclusion,
  type StudyIntroduction,
  type StudyLagScan,
  type StudyMetric,
  type StudyPanel
} from "@/src/lib/schema";

export const STUDY_EXPORT_FILES = [
  "study-metadata.json",
  "screen-metrics.csv",
  "birth-shares.csv",
  "lag-scan.csv",
  "qa-report.json"
] as const;

const FORBIDDEN_EXPORTS = ["credits.jsonl", "principals.json", "title.basics.tsv", "title.principals.tsv", "name.basics.tsv"];

export const ANALYSIS_PROTOCOL: AnalysisProtocol = analysisProtocolSchema.parse({
  id: "study-steve-extinction-v1",
  calculationVersion: "study-metrics-v1",
  seed: "steve-studies-analysis-v1",
  bootstrapReplicates: 1000,
  confidenceLevel: 0.95,
  primaryOutcome: "new_introductions_per_1000",
  primaryVariant: "steve_family",
  panels: ["film", "tv"],
  window: { startYear: 1960, endYear: 2025 },
  lagYears: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
  controls: ["john", "david", "michael", "robert"],
  steveFamily: ["steve", "stephen", "steven", "stevie"],
  commercialPrevalenceCalculated: false,
  publicIndexIncluded: false,
  controlsArePublicEntries: false
});

export function withAnalysisProtocol(overrides: Partial<AnalysisProtocol> = {}): AnalysisProtocol {
  return analysisProtocolSchema.parse({ ...ANALYSIS_PROTOCOL, ...overrides });
}

export type StudyMetadata = {
  studyId: string;
  analysisProtocolId: string;
  calculationVersion: string;
  seed: string;
  bootstrapReplicates: number;
  confidenceLevel: 0.95;
  window: { startYear: 1960; endYear: 2025 };
  primaryOutcome: "new_introductions_per_1000";
  primaryVariant: "steve_family";
  panels: ["film", "tv"];
  sourceSnapshotId: string;
  commercialPrevalenceCalculated: false;
  publicIndexIncluded: false;
  controlsArePublicEntries: false;
  populationsDiffer: string;
  createdAt: string;
};

export type QaCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

export type QaReport = {
  calculationVersion: string;
  studyId: string;
  passed: boolean;
  checks: QaCheck[];
  missingDebutCredits: number;
  suppressedBirthShares: number;
  partialBirthShares: number;
  commercialPrevalenceMetrics: number;
  rawCreditFiles: string[];
  note: string;
};

export type StudyAnalysis = {
  metadata: StudyMetadata;
  screenMetrics: StudyMetric[];
  birthShares: BirthNameShare[];
  lagScan: StudyLagScan[];
  qa: QaReport;
  files: Record<(typeof STUDY_EXPORT_FILES)[number], string>;
};

const POPULATIONS_DIFFER =
  "Birth shares use tabulated SSA names. Screen rates use eligible fictional credits in the supplied sample. The two are not a percentage-point comparison.";

export function runStudyAnalysis(input: {
  catalog: StudyCatalog;
  observations: readonly BirthNameCount[];
  sourceSnapshotId: string;
  now: string;
  protocol?: AnalysisProtocol;
}): StudyAnalysis {
  const protocol = input.protocol ?? ANALYSIS_PROTOCOL;
  const pilot = runFeasibilityPilot({ catalog: input.catalog, now: input.now });
  const screenMetrics = buildScreenMetrics({
    studyId: pilot.population.id,
    credits: pilot.credits,
    introductions: pilot.introductions,
    protocol,
    now: input.now
  });
  const birthShares = buildBirthShares({
    observations: input.observations,
    sourceSnapshotId: input.sourceSnapshotId,
    protocol,
    now: input.now
  });
  const lagScan = buildLagScan({
    studyId: pilot.population.id,
    screenMetrics,
    birthShares,
    protocol,
    now: input.now
  });
  const metadata: StudyMetadata = {
    studyId: pilot.population.id,
    analysisProtocolId: protocol.id,
    calculationVersion: protocol.calculationVersion,
    seed: protocol.seed,
    bootstrapReplicates: protocol.bootstrapReplicates,
    confidenceLevel: 0.95,
    window: { startYear: 1960, endYear: 2025 },
    primaryOutcome: "new_introductions_per_1000",
    primaryVariant: "steve_family",
    panels: ["film", "tv"],
    sourceSnapshotId: input.sourceSnapshotId,
    commercialPrevalenceCalculated: false,
    publicIndexIncluded: false,
    controlsArePublicEntries: false,
    populationsDiffer: POPULATIONS_DIFFER,
    createdAt: input.now
  };
  const files = {
    "study-metadata.json": `${JSON.stringify(metadata, null, 2)}\n`,
    "screen-metrics.csv": screenMetricsCsv(screenMetrics),
    "birth-shares.csv": birthSharesCsv(birthShares),
    "lag-scan.csv": lagScanCsv(lagScan),
    "qa-report.json": ""
  };
  const qa = auditStudyAnalysis({
    metadata,
    screenMetrics,
    birthShares,
    lagScan,
    files,
    credits: pilot.credits,
    introductions: pilot.introductions,
    exclusions: pilot.exclusions,
    protocol
  });
  files["qa-report.json"] = `${JSON.stringify(qa, null, 2)}\n`;

  return { metadata, screenMetrics, birthShares, lagScan, qa, files };
}

/** Re-read an aggregate export. Debut exclusions are not recomputed without the source credits. */
export function auditStudyExport(files: Record<string, string>): QaReport {
  const metadata = parseMetadata(files["study-metadata.json"]);

  return auditStudyAnalysis({
    metadata,
    screenMetrics: parseScreenMetrics(files["screen-metrics.csv"] ?? "", metadata),
    birthShares: parseBirthShares(files["birth-shares.csv"] ?? "", metadata),
    lagScan: parseLagScan(files["lag-scan.csv"] ?? "", metadata),
    files
  });
}

export function auditStudyAnalysis(input: {
  metadata: StudyMetadata;
  screenMetrics: readonly StudyMetric[];
  birthShares: readonly BirthNameShare[];
  lagScan: readonly StudyLagScan[];
  files: Record<string, string>;
  credits?: readonly StudyCharacterCredit[];
  introductions?: readonly StudyIntroduction[];
  exclusions?: readonly StudyExclusion[];
  protocol?: AnalysisProtocol;
}): QaReport {
  const protocol = input.protocol ?? ANALYSIS_PROTOCOL;
  const checks: QaCheck[] = [
    checkFormula(input.screenMetrics),
    checkBounds(input.screenMetrics),
    checkPartition(input.screenMetrics, "new_introductions_per_1000"),
    checkPartition(input.screenMetrics, "named_credit_share_per_1000"),
    checkEmptyBins(input.screenMetrics),
    checkBirthSuppression(input.birthShares),
    checkBirthFormula(input.birthShares),
    checkBirthYears(input.birthShares),
    checkLagScan(input.lagScan, protocol),
    checkNoCommercial(input.screenMetrics, input.metadata),
    checkPublicBoundary(input.metadata),
    checkUniqueIds(input.screenMetrics, input.birthShares),
    checkExportFiles(input.files),
    checkMissingDebuts(input.credits, input.introductions, input.exclusions)
  ];

  return {
    calculationVersion: input.metadata.calculationVersion,
    studyId: input.metadata.studyId,
    passed: checks.every((check) => check.passed),
    checks,
    missingDebutCredits: missingDebutCount(input.credits, input.introductions),
    suppressedBirthShares: input.birthShares.filter((share) => share.observationState === "suppressed_or_absent").length,
    partialBirthShares: input.birthShares.filter((share) => share.observationState === "partial_suppression").length,
    commercialPrevalenceMetrics: 0,
    rawCreditFiles: forbiddenFiles(input.files),
    note: "QA checks the frozen calculation. It does not choose a lag or write a public finding."
  };
}

function buildLagScan(input: {
  studyId: string;
  screenMetrics: readonly StudyMetric[];
  birthShares: readonly BirthNameShare[];
  protocol: AnalysisProtocol;
  now: string;
}): StudyLagScan[] {
  const rows: StudyLagScan[] = [];

  for (const medium of ["film", "tv"] as const) {
    for (const lagYears of input.protocol.lagYears) {
      const birthRates: number[] = [];
      const screenRates: number[] = [];

      for (const decade of studyDecades()) {
        const screen = findScreen(input.screenMetrics, "new_introductions_per_1000", decade, medium, "steve_family");
        const birth = input.birthShares.find(
          (share) => share.birthYear === decade - lagYears && share.sex === "combined" && share.variantLabel === "steve_family"
        );

        if (screen?.rate === null || screen?.rate === undefined || birth?.rate === null || birth?.rate === undefined) {
          continue;
        }

        birthRates.push(birth.rate);
        screenRates.push(screen.rate);
      }

      const correlation = pearson(birthRates, screenRates);
      const status = birthRates.length < 3 ? "insufficient_bins" : correlation === null ? "undefined_correlation" : "reported";
      rows.push(
        studyLagScanSchema.parse({
          id: `lag-${digest([input.studyId, input.protocol.calculationVersion, medium, String(lagYears)])}`,
          studyId: input.studyId,
          lagYears,
          medium,
          pairedDecades: birthRates.length,
          correlation: status === "reported" ? correlation : null,
          status,
          selectedLag: null,
          calculationVersion: input.protocol.calculationVersion,
          createdAt: input.now
        })
      );
    }
  }

  return rows;
}

function checkFormula(metrics: readonly StudyMetric[]): QaCheck {
  const failures = metrics.filter((metric) => {
    if (!metric.metricKind || metric.numerator === null || metric.denominator === null || metric.rate === null) {
      return metric.numerator !== null || metric.denominator !== null || metric.rate !== null;
    }

    return metric.rate !== roundMetric((metricScale(metric.metricKind) * metric.numerator) / metric.denominator);
  });

  return {
    name: "screen_formula",
    passed: failures.length === 0,
    detail: failures.length === 0 ? "Every screen rate matches its numerator, denominator, and scale." : `${failures.length} screen rows break the rate formula.`
  };
}

function checkBounds(metrics: readonly StudyMetric[]): QaCheck {
  const failures = metrics.filter(
    (metric) =>
      metric.numerator !== null &&
      metric.denominator !== null &&
      (metric.numerator > metric.denominator || (metric.uncertaintyLow !== null && metric.uncertaintyHigh !== null && metric.uncertaintyLow > metric.uncertaintyHigh))
  );

  return {
    name: "screen_bounds",
    passed: failures.length === 0,
    detail: failures.length === 0 ? "Numerators fit inside denominators, and interval ends are ordered." : `${failures.length} screen rows are out of bounds.`
  };
}

function checkPartition(metrics: readonly StudyMetric[], metricKind: "new_introductions_per_1000" | "named_credit_share_per_1000"): QaCheck {
  let failures = 0;

  for (const decade of studyDecades()) {
    for (const medium of ["film", "tv"] as const) {
      const rows = metrics.filter((metric) => metric.metricKind === metricKind && metric.decade === decade && metric.medium === medium);
      const family = findVariant(rows, "steve_family");
      const spellings = sumVariant(rows, ["steve", "stephen", "steven", "stevie"]);
      const controls = sumVariant(rows, ["john", "david", "michael", "robert"]);
      const other = sumVariant(rows, ["other"]);

      if (!family || family.denominator === null) {
        if (rows.some((row) => row.rate !== null)) {
          failures += 1;
        }
        continue;
      }

      if (spellings !== (family.numerator ?? -1) || spellings + controls + other !== family.denominator) {
        failures += 1;
      }

      if (rows.some((row) => row.denominator !== family.denominator)) {
        failures += 1;
      }
    }
  }

  return {
    name: `${metricKind}_partition`,
    passed: failures === 0,
    detail: failures === 0 ? `${metricKind} splits the denominator across spellings, controls, and other names.` : `${failures} ${metricKind} cells do not add up.`
  };
}

function checkEmptyBins(metrics: readonly StudyMetric[]): QaCheck {
  const failures = metrics.filter((metric) => metric.completenessFlags.includes("empty_denominator") && (metric.rate !== null || metric.numerator !== null));

  return {
    name: "empty_bins",
    passed: failures.length === 0,
    detail: failures.length === 0 ? "Empty bins keep a null rate." : `${failures.length} empty bins were filled with a number.`
  };
}

function checkBirthSuppression(shares: readonly BirthNameShare[]): QaCheck {
  const failures = shares.filter(
    (share) =>
      (share.observationState !== "reported" && (share.numerator !== null || share.rate !== null)) ||
      (share.observationState === "reported" && share.numerator === 0)
  );

  return {
    name: "birth_suppression",
    passed: failures.length === 0,
    detail: failures.length === 0 ? "Suppressed and partial birth cells have a null numerator and a null rate." : `${failures.length} birth cells turned suppression into a number.`
  };
}

function checkBirthFormula(shares: readonly BirthNameShare[]): QaCheck {
  const failures = shares.filter((share) => {
    if (share.observationState !== "reported" || share.numerator === null || share.denominator === null || share.rate === null) {
      return false;
    }

    return share.rate !== roundMetric((100_000 * share.numerator) / share.denominator);
  });

  return {
    name: "birth_formula",
    passed: failures.length === 0,
    detail: failures.length === 0 ? "Reported birth shares use tabulated SSA births per 100,000." : `${failures.length} birth shares break the formula.`
  };
}

function checkBirthYears(shares: readonly BirthNameShare[]): QaCheck {
  const failures = shares.filter((share) => share.birthYear > 2025);

  return {
    name: "birth_window",
    passed: failures.length === 0,
    detail: failures.length === 0 ? "Birth shares stop at the 2025 cutoff." : `${failures.length} birth shares are past 2025.`
  };
}

function checkLagScan(rows: readonly StudyLagScan[], protocol: AnalysisProtocol): QaCheck {
  const expected = protocol.panels.flatMap((medium) => protocol.lagYears.map((lagYears) => `${medium}:${lagYears}`));
  const actual = rows.map((row) => `${row.medium}:${row.lagYears}`);
  const chosen = rows.some((row) => row.selectedLag !== null);
  const passed = !chosen && expected.every((key) => actual.includes(key)) && rows.length === expected.length;

  return {
    name: "lag_scan",
    passed,
    detail: passed ? "The lag scan reports every predeclared window and does not select one." : "The lag scan is missing a window or selected a lag."
  };
}

function checkNoCommercial(metrics: readonly StudyMetric[], metadata: StudyMetadata): QaCheck {
  const commercial = metrics.filter((metric) => metric.metricKind?.includes("commercial") || (metric.medium !== "film" && metric.medium !== "tv"));
  const passed = commercial.length === 0 && metadata.commercialPrevalenceCalculated === false;

  return {
    name: "no_commercial_prevalence",
    passed,
    detail: passed ? "No commercial prevalence metric is in the screen panel." : "A commercial prevalence metric was written."
  };
}

function checkPublicBoundary(metadata: StudyMetadata): QaCheck {
  const passed = metadata.publicIndexIncluded === false && metadata.controlsArePublicEntries === false;

  return {
    name: "public_boundary",
    passed,
    detail: passed ? "The public index and the control names stay out of the Steve archive." : "The analysis crossed the public-index boundary."
  };
}

function checkUniqueIds(metrics: readonly StudyMetric[], shares: readonly BirthNameShare[]): QaCheck {
  const ids = [...metrics.map((metric) => metric.id), ...shares.map((share) => share.id)];
  const passed = new Set(ids).size === ids.length;

  return {
    name: "stable_ids",
    passed,
    detail: passed ? "Metric ids are unique for this snapshot and calculation version." : "Metric ids collided."
  };
}

function checkExportFiles(files: Record<string, string>): QaCheck {
  const names = Object.keys(files).sort();
  const expected = [...STUDY_EXPORT_FILES].sort();
  const forbidden = forbiddenFiles(files);
  const screen = files["screen-metrics.csv"] ?? "";
  const lag = files["lag-scan.csv"] ?? "";
  const passed =
    names.join() === expected.join() &&
    forbidden.length === 0 &&
    !screen.includes("tconst") &&
    !screen.includes("characters") &&
    !lag.includes("selected_lag");

  return {
    name: "aggregate_export",
    passed,
    detail: passed ? "The export is the aggregate file set." : "The export contains a raw credit file or an unexpected name."
  };
}

function checkMissingDebuts(
  credits: readonly StudyCharacterCredit[] | undefined,
  introductions: readonly StudyIntroduction[] | undefined,
  exclusions: readonly StudyExclusion[] | undefined
): QaCheck {
  if (!credits || !introductions || !exclusions) {
    return { name: "missing_debuts", passed: true, detail: "Debut exclusion was not rechecked from source credits." };
  }

  const introduced = new Set(introductions.map((introduction) => introduction.creditId));
  const excluded = new Set(
    exclusions
      .filter((exclusion) => ["missing_debut_year", "beyond_frozen_cutoff", "outside_study_window"].includes(exclusion.reason))
      .map((exclusion) => exclusion.recordId)
  );
  const missing = credits.filter((credit) => credit.eligible && !introduced.has(credit.id));
  const passed = missing.every((credit) => excluded.has(credit.id)) && introductions.every((introduction) => !excluded.has(introduction.creditId));

  return {
    name: "missing_debuts",
    passed,
    detail: passed ? `${missing.length} eligible credits lack a debut and stay out of the introduction rate.` : "A missing debut entered the introduction rate."
  };
}

function missingDebutCount(credits: readonly StudyCharacterCredit[] | undefined, introductions: readonly StudyIntroduction[] | undefined): number {
  if (!credits || !introductions) {
    return 0;
  }

  const introduced = new Set(introductions.map((introduction) => introduction.creditId));
  return credits.filter((credit) => credit.eligible && !introduced.has(credit.id)).length;
}

function findScreen(
  metrics: readonly StudyMetric[],
  metricKind: string,
  decade: number,
  medium: StudyPanel,
  variant: string
): StudyMetric | undefined {
  return metrics.find(
    (metric) => metric.metricKind === metricKind && metric.decade === decade && metric.medium === medium && metric.variantLabel === variant
  );
}

function findVariant(metrics: readonly StudyMetric[], variant: string): StudyMetric | undefined {
  return metrics.find((metric) => metric.variantLabel === variant);
}

function sumVariant(metrics: readonly StudyMetric[], variants: readonly string[]): number {
  return variants.reduce((sum, variant) => sum + (findVariant(metrics, variant)?.numerator ?? 0), 0);
}

function forbiddenFiles(files: Record<string, string>): string[] {
  return Object.keys(files).filter((name) => FORBIDDEN_EXPORTS.includes(name));
}

const SCREEN_HEADER = [
  "metric_kind",
  "decade",
  "medium",
  "variant",
  "numerator",
  "denominator",
  "rate",
  "uncertainty_low",
  "uncertainty_high",
  "cluster_unit",
  "cluster_count",
  "bootstrap_replicates",
  "denominator_label",
  "flags",
  "calculation_version"
] as const;

const BIRTH_HEADER = [
  "year",
  "sex",
  "variant",
  "numerator",
  "denominator",
  "rate",
  "observation_state",
  "denominator_label",
  "calculation_version"
] as const;

const LAG_HEADER = ["lag_years", "medium", "paired_decades", "correlation", "status", "calculation_version"] as const;

function screenMetricsCsv(metrics: readonly StudyMetric[]): string {
  const header = [...SCREEN_HEADER];
  const lines = metrics.map((metric) =>
    [
      metric.metricKind ?? "",
      metric.decade,
      metric.medium,
      metric.variantLabel,
      cell(metric.numerator),
      cell(metric.denominator),
      cell(metric.rate),
      cell(metric.uncertaintyLow),
      cell(metric.uncertaintyHigh),
      metric.clusterUnit ?? "",
      metric.clusterCount ?? "",
      metric.bootstrapReplicates ?? "",
      metric.denominatorLabel ?? "",
      metric.completenessFlags.join("|"),
      metric.calculationVersion
    ].join(",")
  );

  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

function birthSharesCsv(shares: readonly BirthNameShare[]): string {
  const header = [...BIRTH_HEADER];
  const lines = shares.map((share) =>
    [
      share.birthYear,
      share.sex,
      share.variantLabel,
      cell(share.numerator),
      cell(share.denominator),
      cell(share.rate),
      share.observationState,
      share.denominatorLabel,
      share.calculationVersion
    ].join(",")
  );

  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

function lagScanCsv(rows: readonly StudyLagScan[]): string {
  const header = [...LAG_HEADER];
  const lines = rows.map((row) =>
    [row.lagYears, row.medium, row.pairedDecades, cell(row.correlation), row.status, row.calculationVersion].join(",")
  );

  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

function cell(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function parseMetadata(text: string | undefined): StudyMetadata {
  if (!text) {
    throw new Error("Study metadata is missing.");
  }

  const metadata = JSON.parse(text) as StudyMetadata;

  if (!metadata?.studyId || !metadata.createdAt || !metadata.sourceSnapshotId || !metadata.calculationVersion) {
    throw new Error("Study metadata is missing an id, snapshot, or calculation version.");
  }

  return metadata;
}

function parseScreenMetrics(text: string, metadata: StudyMetadata): StudyMetric[] {
  return csvRows(text, SCREEN_HEADER).map((row) =>
    studyMetricSchema.parse({
      id: `metric-${digest([metadata.studyId, row.metric_kind ?? "", row.decade ?? "", row.medium ?? "", row.variant ?? "", metadata.calculationVersion])}`,
      studyId: metadata.studyId,
      metricKind: row.metric_kind,
      decade: requiredInteger(row.decade ?? ""),
      medium: row.medium,
      variantLabel: row.variant,
      numerator: optionalInteger(row.numerator ?? ""),
      denominator: optionalInteger(row.denominator ?? ""),
      rate: numberCell(row.rate ?? ""),
      uncertaintyLow: numberCell(row.uncertainty_low ?? ""),
      uncertaintyHigh: numberCell(row.uncertainty_high ?? ""),
      denominatorLabel: row.denominator_label,
      clusterUnit: row.cluster_unit,
      clusterCount: requiredInteger(row.cluster_count ?? ""),
      bootstrapReplicates: requiredInteger(row.bootstrap_replicates ?? ""),
      seed: metadata.seed,
      completenessFlags: (row.flags ?? "").split("|").filter((flag) => flag.length > 0),
      calculationVersion: row.calculation_version,
      createdAt: metadata.createdAt
    })
  );
}

function parseBirthShares(text: string, metadata: StudyMetadata): BirthNameShare[] {
  return csvRows(text, BIRTH_HEADER).map((row) =>
    birthNameShareSchema.parse({
      id: `share-${digest([metadata.sourceSnapshotId, row.year ?? "", row.sex ?? "", row.variant ?? "", row.calculation_version ?? ""])}`,
      sourceSnapshotId: metadata.sourceSnapshotId,
      birthYear: requiredInteger(row.year ?? ""),
      sex: row.sex,
      variantLabel: row.variant,
      numerator: optionalInteger(row.numerator ?? ""),
      denominator: optionalInteger(row.denominator ?? ""),
      rate: numberCell(row.rate ?? ""),
      denominatorLabel: row.denominator_label,
      observationState: row.observation_state,
      calculationVersion: row.calculation_version,
      createdAt: metadata.createdAt
    })
  );
}

function parseLagScan(text: string, metadata: StudyMetadata): StudyLagScan[] {
  return csvRows(text, LAG_HEADER).map((row) =>
    studyLagScanSchema.parse({
      id: `lag-${digest([metadata.studyId, row.medium ?? "", row.lag_years ?? "", row.calculation_version ?? ""])}`,
      studyId: metadata.studyId,
      lagYears: requiredInteger(row.lag_years ?? ""),
      medium: row.medium,
      pairedDecades: requiredInteger(row.paired_decades ?? ""),
      correlation: numberCell(row.correlation ?? ""),
      status: row.status,
      selectedLag: null,
      calculationVersion: row.calculation_version,
      createdAt: metadata.createdAt
    })
  );
}

function csvRows(text: string, header: readonly string[]): Array<Record<string, string>> {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
  const [first, ...rest] = lines;

  if (!first || first !== header.join(",")) {
    throw new Error(`Unexpected CSV header. Expected ${header.join(",")}.`);
  }

  return rest.map((line) => {
    const cells = line.split(",");

    if (cells.length !== header.length) {
      throw new Error("A study CSV row has the wrong number of columns.");
    }

    return Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""]));
  });
}

function optionalInteger(value: string): number | null {
  if (value === "") {
    return null;
  }

  return requiredInteger(value);
}

function requiredInteger(value: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(value === "" ? "A study CSV cell is missing a number." : `Expected an integer cell and found ${value}.`);
  }

  return Number(value);
}

function numberCell(value: string): number | null {
  if (value === "") {
    return null;
  }

  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new Error(`Expected a numeric cell and found ${value}.`);
  }

  return Number(value);
}

function digest(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
}
