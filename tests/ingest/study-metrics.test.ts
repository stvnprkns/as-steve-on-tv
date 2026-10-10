import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { roundMetric, unitStream } from "../../src/lib/data/bootstrap";
import { runFeasibilityPilot } from "../../src/lib/data/coverage";
import { checksumTextFiles, parseSsaTexts, type SsaTextFile } from "../../src/lib/data/ssa";
import {
  ANALYSIS_PROTOCOL,
  auditStudyAnalysis,
  auditStudyExport,
  runStudyAnalysis,
  withAnalysisProtocol,
  type StudyAnalysis
} from "../../src/lib/data/study-analysis";
import { buildScreenMetrics } from "../../src/lib/data/study-metrics";
import {
  birthNameShareSchema,
  steveEntrySchema,
  studyCatalogSchema,
  studyCharacterCreditSchema,
  studyIntroductionSchema,
  studyMetricSchema,
  type BirthNameShare,
  type StudyCharacterCredit,
  type StudyIntroduction
} from "../../src/lib/schema";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NOW = "2026-10-10T00:00:00Z";
const RELEASE = "2026-05-08";

const catalog = studyCatalogSchema.parse(
  JSON.parse(readFileSync(path.join(repoRoot, "tests", "fixtures", "study", "catalog.json"), "utf8"))
);

function ssaFiles(): SsaTextFile[] {
  return [
    { name: "yob1959.txt", text: "Steve,M,20\n" },
    {
      name: "yob1960.txt",
      text: ["name,sex,count", "Steve,M,100", "Steve,M,50", "Steven,M,40", "Steve,F,8", "Tiny,M,3", "Zero,M,0", "Four,F,4", "Five,M,5", "John,M,500"].join("\n")
    },
    { name: "yob1962.txt", text: "Steve,M,90\n" },
    { name: "yob2026.txt", text: "Steve,M,10\n" }
  ];
}

function loadAnalysis(protocol = ANALYSIS_PROTOCOL) {
  const files = ssaFiles();
  const imported = parseSsaTexts(files, {
    releaseDate: RELEASE,
    retrievedAt: NOW,
    contentSha256: checksumTextFiles(files)
  });

  return runStudyAnalysis({
    catalog,
    observations: imported.observations,
    sourceSnapshotId: imported.snapshot.id,
    now: NOW,
    protocol
  });
}

function screen(
  analysis: StudyAnalysis,
  metricKind: string,
  decade: number,
  medium: string,
  variant: string
) {
  const found = analysis.screenMetrics.find(
    (row) => row.metricKind === metricKind && row.decade === decade && row.medium === medium && row.variantLabel === variant
  );
  assert.ok(found, `${metricKind} ${decade} ${medium} ${variant}`);
  return found;
}

function birth(analysis: StudyAnalysis, year: number, sex: string, variant: string): BirthNameShare {
  const found = analysis.birthShares.find((row) => row.birthYear === year && row.sex === sex && row.variantLabel === variant);
  assert.ok(found, `${year} ${sex} ${variant}`);
  return found;
}

function credit(input: {
  id: string;
  workProviderId: string;
  decade: number;
  variantLabel: "steve" | "john" | "other";
  performerId: string;
  identityKey: string;
  creditedName: string;
}): StudyCharacterCredit {
  return studyCharacterCreditSchema.parse({
    id: input.id,
    studyId: "study-cluster-check",
    provider: "imdb",
    workProviderId: input.workProviderId,
    decade: input.decade,
    medium: "film",
    creditedName: input.creditedName,
    normalizedName: input.creditedName.toLowerCase(),
    variantLabel: input.variantLabel,
    eligible: true,
    performerId: input.performerId,
    identityKey: input.identityKey,
    publicCandidate: false,
    createdAt: NOW
  });
}

function introduction(row: StudyCharacterCredit, year: number): StudyIntroduction {
  return studyIntroductionSchema.parse({
    id: `introduction-${row.id}`,
    studyId: row.studyId,
    identityKey: row.identityKey,
    creditId: row.id,
    firstAppearanceYear: year,
    medium: "film",
    eligible: true,
    provenance: "film_release_year_proxy",
    createdAt: NOW
  });
}

test("the analysis protocol is frozen and the feasibility pilot still does not emit a rate", () => {
  const protocol = JSON.parse(readFileSync(path.join(repoRoot, "research", "studies", "steve-extinction.json"), "utf8"));
  const feasibility = JSON.parse(readFileSync(path.join(repoRoot, "research", "studies", "steve-extinction-feasibility.json"), "utf8"));
  const pilot = runFeasibilityPilot({ catalog, now: NOW });

  assert.deepEqual(protocol, ANALYSIS_PROTOCOL);
  assert.equal(feasibility.primaryOutcomeCalculated, false);
  assert.equal(pilot.report.primaryOutcomeCalculated, false);
  assert.equal(ANALYSIS_PROTOCOL.primaryOutcome, "new_introductions_per_1000");
  assert.equal(ANALYSIS_PROTOCOL.commercialPrevalenceCalculated, false);
  assert.equal(ANALYSIS_PROTOCOL.publicIndexIncluded, false);
  assert.equal(ANALYSIS_PROTOCOL.controlsArePublicEntries, false);
});

test("synthetic screen rates keep film and television apart and leave missing debuts out", () => {
  const analysis = loadAnalysis();
  const filmSteve = screen(analysis, "new_introductions_per_1000", 1960, "film", "steve_family");
  const filmJohn = screen(analysis, "new_introductions_per_1000", 1960, "film", "john");
  const filmOther = screen(analysis, "new_introductions_per_1000", 1960, "film", "other");
  const filmStephen = screen(analysis, "new_introductions_per_1000", 1960, "film", "stephen");
  const filmTv = screen(analysis, "new_introductions_per_1000", 1960, "tv", "steve_family");
  const emptyFilm = screen(analysis, "new_introductions_per_1000", 1980, "film", "steve_family");
  const tvSteve = screen(analysis, "new_introductions_per_1000", 1970, "tv", "steve_family");
  const tvRobert = screen(analysis, "new_introductions_per_1000", 1970, "tv", "robert");
  const tvFilm = screen(analysis, "new_introductions_per_1000", 1970, "film", "steve_family");
  const tvCredits = screen(analysis, "named_credit_share_per_1000", 1970, "tv", "steve_family");
  const tvRobertCredits = screen(analysis, "named_credit_share_per_1000", 1970, "tv", "robert");
  const tvWorks = screen(analysis, "work_share_per_100", 1970, "tv", "steve_family");

  assert.equal(analysis.qa.passed, true, analysis.qa.checks.filter((check) => !check.passed).map((check) => check.detail).join("\n"));
  assert.equal(analysis.qa.missingDebutCredits, 2);
  assert.equal(filmSteve.numerator, 1);
  assert.equal(filmSteve.denominator, 4);
  assert.equal(filmSteve.clusterCount, 3);
  assert.equal(filmSteve.clusterUnit, "work");
  assert.equal(filmSteve.rate, 250);
  assert.equal(filmSteve.rate, roundMetric(1000 / 4));
  assert.equal(filmJohn.rate, 250);
  assert.equal(filmOther.numerator, 2);
  assert.equal(filmOther.rate, 500);
  assert.equal(filmStephen.numerator, 0);
  assert.equal(filmStephen.rate, 0);
  assert.equal(filmTv.rate, null);
  assert.equal(filmTv.numerator, null);
  assert.ok(filmTv.completenessFlags.includes("empty_denominator"));
  assert.equal(emptyFilm.rate, null);
  assert.equal(tvFilm.rate, null);
  assert.equal(tvSteve.numerator, 1);
  assert.equal(tvSteve.denominator, 1);
  assert.equal(tvSteve.clusterCount, 1);
  assert.equal(tvSteve.clusterUnit, "series");
  assert.equal(tvSteve.rate, 1000);
  assert.equal(tvSteve.uncertaintyLow, 1000);
  assert.equal(tvSteve.uncertaintyHigh, 1000);
  assert.equal(tvRobert.numerator, 0);
  assert.equal(tvRobert.rate, 0);
  assert.equal(tvCredits.numerator, 2);
  assert.equal(tvCredits.denominator, 3);
  assert.equal(tvCredits.rate, 666.666667);
  assert.equal(tvCredits.rate, roundMetric(2000 / 3));
  assert.equal(tvRobertCredits.numerator, 1);
  assert.equal(tvRobertCredits.rate, 333.333333);
  assert.equal(tvWorks.numerator, 1);
  assert.equal(tvWorks.denominator, 1);
  assert.equal(tvWorks.rate, 100);
  assert.equal(analysis.metadata.publicIndexIncluded, false);
  assert.equal(analysis.screenMetrics.some((row) => row.metricKind?.includes("commercial")), false);
});

test("birth shares keep suppression null and do not invent a year after 2025", () => {
  const analysis = loadAnalysis();
  const steve = birth(analysis, 1960, "M", "steve");
  const stevie = birth(analysis, 1960, "M", "stevie");
  const family = birth(analysis, 1960, "M", "steve_family");
  const combined = birth(analysis, 1960, "combined", "steve");

  assert.equal(steve.numerator, 100);
  assert.equal(steve.denominator, 645);
  assert.equal(steve.observationState, "reported");
  assert.equal(steve.denominatorLabel, "ssa_reported_same_sex_births");
  assert.equal(steve.rate, 15503.875969);
  assert.equal(steve.rate, roundMetric((100_000 * 100) / 645));
  assert.equal(stevie.numerator, null);
  assert.equal(stevie.rate, null);
  assert.equal(stevie.observationState, "suppressed_or_absent");
  assert.equal(stevie.denominator, 645);
  assert.equal(family.observationState, "partial_suppression");
  assert.equal(family.numerator, null);
  assert.equal(family.rate, null);
  assert.equal(family.denominator, 645);
  assert.equal(combined.numerator, 108);
  assert.equal(combined.denominator, 653);
  assert.equal(combined.rate, roundMetric((100_000 * 108) / 653));
  assert.equal(analysis.birthShares.some((row) => row.birthYear === 1959), true);
  assert.equal(analysis.birthShares.some((row) => row.birthYear > 2025), false);
  assert.equal(analysis.birthShares.some((row) => row.numerator === 0), false);
  assert.equal(analysis.lagScan.length, 22);
  assert.equal(analysis.lagScan.every((row) => row.selectedLag === null), true);
  assert.equal(analysis.lagScan.every((row) => row.status === "insufficient_bins" && row.correlation === null), true);
  assert.doesNotMatch(analysis.files["birth-shares.csv"], /,0,/);
  assert.doesNotMatch(analysis.files["birth-shares.csv"], /2026/);
  assert.doesNotMatch(analysis.files["screen-metrics.csv"], /Steve Harrington/);
  assert.doesNotMatch(analysis.files["screen-metrics.csv"], /tconst/);
  assert.doesNotMatch(analysis.files["lag-scan.csv"], /selected_lag/);
});

test("the same snapshot rebuilds the same ids and a new seed changes a multi-work interval", () => {
  const first = loadAnalysis();
  const second = loadAnalysis();
  const alpha = loadAnalysis(withAnalysisProtocol({ seed: "seed-alpha-study", bootstrapReplicates: 20 }));
  const beta = loadAnalysis(withAnalysisProtocol({ seed: "seed-beta-study", bootstrapReplicates: 20 }));
  const alphaDraws = drawsFor("seed-alpha-study");
  const betaDraws = drawsFor("seed-beta-study");

  assert.deepEqual(
    first.screenMetrics.map((row) => [row.id, row.rate, row.uncertaintyLow, row.uncertaintyHigh]),
    second.screenMetrics.map((row) => [row.id, row.rate, row.uncertaintyLow, row.uncertaintyHigh])
  );
  assert.deepEqual(
    first.birthShares.map((row) => [row.id, row.rate, row.numerator]),
    second.birthShares.map((row) => [row.id, row.rate, row.numerator])
  );
  assert.deepEqual(first.files["screen-metrics.csv"], second.files["screen-metrics.csv"]);
  assert.notDeepEqual(alphaDraws, betaDraws);
  assert.notEqual(
    screen(alpha, "new_introductions_per_1000", 1960, "film", "steve_family").id,
    screen(beta, "new_introductions_per_1000", 1960, "film", "steve_family").id
  );
  assert.notDeepEqual(
    [
      screen(alpha, "new_introductions_per_1000", 1960, "film", "steve_family").uncertaintyLow,
      screen(alpha, "new_introductions_per_1000", 1960, "film", "steve_family").uncertaintyHigh
    ],
    [
      screen(beta, "new_introductions_per_1000", 1960, "film", "steve_family").uncertaintyLow,
      screen(beta, "new_introductions_per_1000", 1960, "film", "steve_family").uncertaintyHigh
    ]
  );
  assert.equal(screen(alpha, "new_introductions_per_1000", 1970, "tv", "steve_family").uncertaintyLow, 1000);
  assert.equal(screen(beta, "new_introductions_per_1000", 1970, "tv", "steve_family").uncertaintyHigh, 1000);
});

test("introduction clusters follow works and debut decades, and a duplicate identity is refused", () => {
  const earlySteve = credit({
    id: "credit-early-steve",
    workProviderId: "ttone",
    decade: 1970,
    variantLabel: "steve",
    performerId: "nm1",
    identityKey: "identity-early-steve",
    creditedName: "Steve One"
  });
  const earlyJohn = credit({
    id: "credit-early-john",
    workProviderId: "ttone",
    decade: 1970,
    variantLabel: "john",
    performerId: "nm2",
    identityKey: "identity-early-john",
    creditedName: "John Two"
  });
  const other = credit({
    id: "credit-other",
    workProviderId: "tttwo",
    decade: 1970,
    variantLabel: "other",
    performerId: "nm3",
    identityKey: "identity-other",
    creditedName: "Bob Three"
  });
  const late = credit({
    id: "credit-late",
    workProviderId: "ttlate",
    decade: 1970,
    variantLabel: "steve",
    performerId: "nm4",
    identityKey: "identity-late",
    creditedName: "Steve Late"
  });
  const credits = [earlySteve, earlyJohn, other, late];
  const introductions = [introduction(earlySteve, 1972), introduction(earlyJohn, 1972), introduction(other, 1975), introduction(late, 1981)];
  const metrics = buildScreenMetrics({
    studyId: "study-cluster-check",
    credits,
    introductions,
    protocol: ANALYSIS_PROTOCOL,
    now: NOW
  });
  const intro1970 = metrics.find(
    (row) => row.metricKind === "new_introductions_per_1000" && row.decade === 1970 && row.variantLabel === "steve_family"
  );
  const intro1980 = metrics.find(
    (row) => row.metricKind === "new_introductions_per_1000" && row.decade === 1980 && row.variantLabel === "steve"
  );
  const credits1970 = metrics.find(
    (row) => row.metricKind === "named_credit_share_per_1000" && row.decade === 1970 && row.variantLabel === "steve_family"
  );

  assert.equal(intro1970?.clusterCount, 2);
  assert.equal(intro1970?.denominator, 3);
  assert.equal(intro1970?.numerator, 1);
  assert.equal(intro1980?.denominator, 1);
  assert.equal(intro1980?.numerator, 1);
  assert.equal(intro1980?.rate, 1000);
  assert.equal(credits1970?.denominator, 4);
  assert.throws(
    () =>
      buildScreenMetrics({
        studyId: "study-cluster-check",
        credits,
        introductions: [introductions[0]!, { ...introductions[0]!, id: "introduction-copy" }],
        protocol: ANALYSIS_PROTOCOL,
        now: NOW
      }),
    /Duplicate study introduction/
  );
});

test("a reported birth numerator of zero fails QA and an export reread checks the formulas", () => {
  const analysis = loadAnalysis();
  const steve = birth(analysis, 1960, "M", "steve");
  const zero = birthNameShareSchema.parse({ ...steve, numerator: 0, rate: 0 });
  const broken = auditStudyAnalysis({
    metadata: analysis.metadata,
    screenMetrics: analysis.screenMetrics,
    birthShares: analysis.birthShares.map((row) => (row.id === zero.id ? zero : row)),
    lagScan: analysis.lagScan,
    files: analysis.files
  });
  const reread = auditStudyExport(analysis.files);
  const tampered = studyMetricSchema.parse({
    ...screen(analysis, "new_introductions_per_1000", 1960, "film", "steve"),
    rate: 251
  });
  const files = {
    ...analysis.files,
    "screen-metrics.csv": analysis.files["screen-metrics.csv"].replace(",1,4,250,", ",1,4,251,")
  };
  const failed = auditStudyExport(files);

  assert.equal(broken.checks.find((check) => check.name === "birth_suppression")?.passed, false);
  assert.equal(reread.passed, true);
  assert.match(reread.checks.find((check) => check.name === "missing_debuts")?.detail ?? "", /not rechecked/);
  assert.equal(tampered.rate, 251);
  assert.equal(failed.passed, false);
  assert.equal(failed.checks.find((check) => check.name === "screen_formula")?.passed, false);
});

test("study migration adds analysis tables without dropping earlier ones", () => {
  const sql = readFileSync(path.join(repoRoot, "db", "migrations", "0004_study_analysis.sql"), "utf8");
  const earlier = readFileSync(path.join(repoRoot, "db", "migrations", "0003_steve_studies.sql"), "utf8");

  assert.match(sql, /selected_lag is null/);
  assert.match(sql, /numerator > 0/);
  assert.match(sql, /create table if not exists birth_name_share/);
  assert.match(sql, /create table if not exists study_lag_scan/);
  assert.doesNotMatch(sql, /drop table/i);
  assert.doesNotMatch(earlier, /birth_name_share/);
  assert.doesNotMatch(earlier, /metric_kind/);
});

test("published entries stay unchanged", () => {
  const files = readdirSync(path.join(repoRoot, "content", "entries")).filter((file) => file.endsWith(".json"));

  assert.equal(files.length, 11);

  for (const file of files) {
    const parsed = steveEntrySchema.parse(JSON.parse(readFileSync(path.join(repoRoot, "content", "entries", file), "utf8")));
    assert.equal(parsed.identityId, undefined);
  }
});

test("study commands stay private, write aggregates only, and fail a broken export", () => {
  const tsx = path.join(repoRoot, "node_modules", ".bin", "tsx");
  const ssa = mkdtempSync(path.join(tmpdir(), "study-ssa-"));
  const out = mkdtempSync(path.join(tmpdir(), "study-out-"));

  for (const file of ssaFiles()) {
    writeFileSync(path.join(ssa, file.name), file.text);
  }

  try {
    const missing = spawnSync(tsx, ["scripts/build-study.ts"], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /--catalog/);

    const dryRun = spawnSync(
      tsx,
      [
        "scripts/build-study.ts",
        "--catalog",
        path.join(repoRoot, "tests", "fixtures", "study", "catalog.json"),
        "--ssa",
        ssa,
        "--release-date",
        RELEASE,
        "--out",
        out
      ],
      { cwd: repoRoot, encoding: "utf8" }
    );
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.match(dryRun.stdout, /qa: passed/);
    assert.match(dryRun.stdout, /film 1960 steve_family introductions per 1000: 250/);
    assert.match(dryRun.stdout, /wrote nothing/);
    assert.doesNotMatch(dryRun.stdout, /Steve Harrington/);
    assert.equal(readdirSync(out).length, 0);

    const written = spawnSync(
      tsx,
      [
        "scripts/build-study.ts",
        "--catalog",
        path.join(repoRoot, "tests", "fixtures", "study", "catalog.json"),
        "--ssa",
        ssa,
        "--release-date",
        RELEASE,
        "--write",
        "--out",
        out
      ],
      { cwd: repoRoot, encoding: "utf8" }
    );
    assert.equal(written.status, 0, written.stderr);
    const studyDir = readdirSync(out)[0];
    const analysisDir = path.join(out, studyDir ?? "", "analysis");
    assert.deepEqual(readdirSync(analysisDir).sort(), [
      "birth-shares.csv",
      "lag-scan.csv",
      "qa-report.json",
      "screen-metrics.csv",
      "study-metadata.json"
    ]);
    const qa = spawnSync(tsx, ["scripts/audit-study.ts", "--dir", analysisDir], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(qa.status, 0, qa.stderr);
    assert.match(qa.stdout, /Study QA passed/);

    const screenPath = path.join(analysisDir, "screen-metrics.csv");
    writeFileSync(screenPath, readFileSync(screenPath, "utf8").replace(",1,4,250,", ",1,4,251,"));
    const failed = spawnSync(tsx, ["scripts/audit-study.ts", "--dir", analysisDir], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(failed.status, 1);
    assert.match(failed.stdout, /screen_formula/);

    const fromIndex = spawnSync(
      tsx,
      [
        "scripts/build-study.ts",
        "--catalog",
        path.join(repoRoot, "content", "entries", "steve-harrington-stranger-things.json"),
        "--ssa",
        ssa,
        "--release-date",
        RELEASE
      ],
      { cwd: repoRoot, encoding: "utf8" }
    );
    assert.equal(fromIndex.status, 1);
    assert.match(fromIndex.stderr, /public index/);

    const forbidden = path.join(repoRoot, "content", "public", "study-phase4-test");
    const refused = spawnSync(
      tsx,
      [
        "scripts/build-study.ts",
        "--catalog",
        path.join(repoRoot, "tests", "fixtures", "study", "catalog.json"),
        "--ssa",
        ssa,
        "--release-date",
        RELEASE,
        "--write",
        "--out",
        forbidden
      ],
      { cwd: repoRoot, encoding: "utf8" }
    );
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /Refusing to write/);
  } finally {
    rmSync(ssa, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
    rmSync(path.join(repoRoot, "content", "public", "study-phase4-test"), { recursive: true, force: true });
  }
});

function drawsFor(seed: string): number[] {
  const random = unitStream([seed, "study-metrics-v1", "new_introductions_per_1000", "1960", "film"]);
  return [random(), random(), random()];
}
