import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { StudyStory } from "../../src/components/studies/study-story";
import { checksumTextFiles, parseSsaTexts, type SsaTextFile } from "../../src/lib/data/ssa";
import { STUDY_EXPORT_FILES } from "../../src/lib/data/study-analysis";
import { runStudyAnalysis } from "../../src/lib/data/study-analysis";
import {
  inProgressStory,
  loadStudyStory,
  prepareStudyPublication,
  publicStudyDirectory,
  publishStudyBundle
} from "../../src/lib/data/study-story";
import { studyCatalogSchema } from "../../src/lib/schema";

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

async function writeAnalysisExport(): Promise<string> {
  const files = ssaFiles();
  const imported = parseSsaTexts(files, {
    releaseDate: RELEASE,
    retrievedAt: NOW,
    contentSha256: checksumTextFiles(files)
  });
  const analysis = runStudyAnalysis({
    catalog,
    observations: imported.observations,
    sourceSnapshotId: imported.snapshot.id,
    now: NOW
  });
  const directory = mkdtempSync(path.join(tmpdir(), "study-story-"));
  await mkdir(directory, { recursive: true });

  for (const name of STUDY_EXPORT_FILES) {
    await writeFile(path.join(directory, name), analysis.files[name]);
  }

  return directory;
}

function htmlFor(view: Awaited<ReturnType<typeof loadStudyStory>>): string {
  return renderToStaticMarkup(createElement(StudyStory, { view }));
}

test("the public study page stays unpublished until a QA-passed export exists", async () => {
  const view = await loadStudyStory(publicStudyDirectory(repoRoot));
  const html = htmlFor(view);

  assert.equal(existsSync(path.join(publicStudyDirectory(repoRoot), "screen-metrics.csv")), false);
  assert.equal(view.status, "in_progress");
  assert.equal(view.conclusion, null);
  assert.equal(inProgressStory().conclusion, null);
  assert.match(html, /Where have all the Steves gone/);
  assert.match(html, /stops at the question and the rules/);
  assert.match(html, /href="\/archive"/);
  assert.match(html, /href="\/method"/);
  assert.doesNotMatch(html, /250/);
  assert.doesNotMatch(html, /666\.666667/);
  assert.doesNotMatch(html, /15503/);
  assert.doesNotMatch(html, /Steve is disappearing|Steve is thriving|extinction is confirmed/i);
});

test("a validated export draws charts from its own rates and leaves the question open", async () => {
  const directory = await writeAnalysisExport();

  try {
    const view = await loadStudyStory(directory);
    assert.equal(view.status, "published");

    if (view.status !== "published") {
      return;
    }

    const film = view.primary.find((point) => point.medium === "film" && point.decade === 1960);
    const television = view.primary.find((point) => point.medium === "tv" && point.decade === 1970);
    const empty = view.primary.find((point) => point.medium === "film" && point.decade === 1980);
    const robert = view.controls.find((point) => point.medium === "tv" && point.decade === 1970 && point.variant === "robert");
    const birth = view.births.find((point) => point.year === 1960);
    const html = htmlFor(view);

    assert.equal(view.conclusion, null);
    assert.equal(view.summary.conclusion, null);
    assert.equal(film?.numerator, 1);
    assert.equal(film?.denominator, 4);
    assert.equal(film?.rate, 250);
    assert.equal(television?.rate, 1000);
    assert.equal(television?.uncertaintyLow, 1000);
    assert.equal(television?.uncertaintyHigh, 1000);
    assert.equal(empty?.rate, null);
    assert.equal(robert?.rate, 0);
    assert.equal(birth?.observationState, "partial_suppression");
    assert.equal(birth?.rate, null);
    assert.equal(view.births.some((point) => point.year > 2025), false);
    assert.equal(view.lags.length, 22);
    assert.equal(view.lags.every((point) => point.selected === false), true);
    assert.match(html, /250/);
    assert.match(html, /unpublished/);
    assert.match(html, /partial_suppression/);
    assert.match(html, />no</);
    assert.doesNotMatch(html, /Steve is disappearing|Steve is thriving|extinction is confirmed/i);
    assert.doesNotMatch(html, /commercial prevalence line[\s\S]*\d+ per/);
    assert.equal(view.summary.commercialPrevalenceCalculated, false);
    assert.equal(view.summary.publicIndexIncluded, false);

    writeFileSync(path.join(directory, "credits.jsonl"), "{\"tconst\":\"ttnorth\"}\n");
    const leaked = await loadStudyStory(directory);
    assert.equal(leaked.status, "in_progress");
    assert.doesNotMatch(htmlFor(leaked), /250/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a tampered rate or a rewritten conclusion stays off the page", async () => {
  const directory = await writeAnalysisExport();

  try {
    const summary = await prepareStudyPublication(directory);
    assert.equal(summary.summary.conclusion, null);
    await writeFile(path.join(directory, "story-summary.json"), `${JSON.stringify(summary.summary, null, 2)}\n`);
    const faithful = await loadStudyStory(directory);
    assert.equal(faithful.status, "published");

    const rewritten = { ...summary.summary, conclusion: "Steve is disappearing" };
    writeFileSync(path.join(directory, "story-summary.json"), `${JSON.stringify(rewritten)}\n`);
    const hidden = await loadStudyStory(directory);
    assert.equal(hidden.status, "in_progress");
    assert.doesNotMatch(htmlFor(hidden), /Steve is disappearing/);

    writeFileSync(path.join(directory, "story-summary.json"), `${JSON.stringify(summary.summary, null, 2)}\n`);
    const screenPath = path.join(directory, "screen-metrics.csv");
    writeFileSync(screenPath, readFileSync(screenPath, "utf8").replace(",1,4,250,", ",1,4,251,"));
    const broken = await loadStudyStory(directory);
    assert.equal(broken.status, "in_progress");
    assert.doesNotMatch(htmlFor(broken), /251/);
    await assert.rejects(prepareStudyPublication(directory), /QA failed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("publish copies aggregates only and the public index stays the default", async () => {
  const source = await writeAnalysisExport();
  const destination = mkdtempSync(path.join(tmpdir(), "study-publish-"));
  const cliOut = path.join(repoRoot, "content", "public", "studies", "phase5-cli-test");
  const tsx = path.join(repoRoot, "node_modules", ".bin", "tsx");

  try {
    const summary = await publishStudyBundle({ sourceDir: source, destination });
    const published = await loadStudyStory(destination);
    assert.equal(summary.conclusion, null);
    assert.equal(published.status, "published");
    assert.deepEqual(readdirSync(destination).sort(), [
      "birth-shares.csv",
      "lag-scan.csv",
      "qa-report.json",
      "screen-metrics.csv",
      "story-summary.json",
      "study-metadata.json"
    ]);
    assert.doesNotMatch(readFileSync(path.join(destination, "story-summary.json"), "utf8"), /Steve is disappearing/);

    const dryRun = spawnSync(tsx, ["scripts/publish-study.ts", "--dir", source, "--out", cliOut], {
      cwd: repoRoot,
      encoding: "utf8"
    });
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.match(dryRun.stdout, /conclusion: none/);
    assert.match(dryRun.stdout, /wrote nothing/);
    assert.equal(existsSync(cliOut), false);

    const written = spawnSync(tsx, ["scripts/publish-study.ts", "--dir", source, "--out", cliOut, "--write"], {
      cwd: repoRoot,
      encoding: "utf8"
    });
    assert.equal(written.status, 0, written.stderr);
    assert.equal(existsSync(path.join(cliOut, "story-summary.json")), true);
    assert.equal(existsSync(path.join(cliOut, "credits.jsonl")), false);

    const refused = spawnSync(
      tsx,
      ["scripts/publish-study.ts", "--dir", source, "--out", path.join(repoRoot, "content", "entries"), "--write"],
      { cwd: repoRoot, encoding: "utf8" }
    );
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /Refusing to publish/);
    assert.equal(existsSync(path.join(publicStudyDirectory(repoRoot), "screen-metrics.csv")), false);
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(destination, { recursive: true, force: true });
    rmSync(cliOut, { recursive: true, force: true });
  }
});
