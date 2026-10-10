import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertPrivateResearchPath, assertStudyCatalogPath } from "../src/lib/data/research-paths";
import { checksumTextFiles, parseSsaTexts, parseSsaZip, type SsaTextFile } from "../src/lib/data/ssa";
import { STUDY_EXPORT_FILES, runStudyAnalysis } from "../src/lib/data/study-analysis";
import { birthNameCountSchema, studyCatalogSchema, type BirthNameCount } from "../src/lib/schema";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const USAGE =
  "Pass --catalog pointing at a private JSON catalog and --ssa pointing at an SSA names.zip, a directory of yobYYYY.txt files, or a directory that already contains birth-name-count.jsonl. Pass --release-date YYYY-MM-DD unless that directory already has birth-name-count.jsonl. Rates are written only with --write, and only after QA passes.";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? undefined : process.argv[index + 1];

  if (!value || value.startsWith("--")) {
    return undefined;
  }

  return value;
}

async function loadSsa(ssaPath: string, releaseDate: string | undefined): Promise<{ observations: BirthNameCount[]; sourceSnapshotId: string }> {
  const info = await stat(ssaPath);

  if (info.isDirectory()) {
    const jsonlPath = path.join(ssaPath, "birth-name-count.jsonl");

    try {
      const text = await readFile(jsonlPath, "utf8");
      const observations = text
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => birthNameCountSchema.parse(JSON.parse(line)));
      const sourceSnapshotId = observations[0]?.sourceSnapshotId;

      if (!sourceSnapshotId || observations.some((row) => row.sourceSnapshotId !== sourceSnapshotId)) {
        throw new Error(`Birth counts in ${jsonlPath} do not share one snapshot id.`);
      }

      return { observations, sourceSnapshotId };
    } catch (error) {
      const missing = error instanceof Error && "code" in error && error.code === "ENOENT";

      if (!missing) {
        throw error;
      }
    }

    if (!releaseDate) {
      throw new Error("Pass --release-date YYYY-MM-DD with a directory of yobYYYY.txt files.");
    }

    const names = (await readdir(ssaPath)).filter((name) => /^yob\d{4}\.txt$/i.test(name)).sort();
    const texts: SsaTextFile[] = [];

    for (const name of names) {
      texts.push({ name, text: await readFile(path.join(ssaPath, name), "utf8") });
    }

    const imported = parseSsaTexts(texts, {
      releaseDate,
      retrievedAt: new Date().toISOString(),
      contentSha256: checksumTextFiles(texts)
    });

    return { observations: imported.observations, sourceSnapshotId: imported.snapshot.id };
  }

  if (!releaseDate) {
    throw new Error("Pass --release-date YYYY-MM-DD with an SSA names.zip.");
  }

  const imported = parseSsaZip(await readFile(ssaPath), {
    releaseDate,
    retrievedAt: new Date().toISOString()
  });

  return { observations: imported.observations, sourceSnapshotId: imported.snapshot.id };
}

async function main() {
  const catalogPath = readArg("--catalog");
  const ssaPath = readArg("--ssa");
  const releaseDate = readArg("--release-date");
  const write = process.argv.includes("--write");
  const outRoot = path.resolve(readArg("--out") ?? path.join(repoRoot, "research", "private", "studies"));

  if (!catalogPath || !ssaPath) {
    throw new Error(USAGE);
  }

  assertStudyCatalogPath(repoRoot, catalogPath);

  let catalogText: string;

  try {
    catalogText = await readFile(catalogPath, "utf8");
  } catch {
    throw new Error(`Missing study catalog: ${catalogPath}`);
  }

  const catalog = studyCatalogSchema.parse(JSON.parse(catalogText));
  const ssa = await loadSsa(ssaPath, releaseDate);
  const analysis = runStudyAnalysis({
    catalog,
    observations: ssa.observations,
    sourceSnapshotId: ssa.sourceSnapshotId,
    now: new Date().toISOString()
  });
  const heading = write ? "Study analysis completed." : "Study analysis dry run complete.";

  console.log(heading);
  console.log(`- study: ${analysis.metadata.studyId}`);
  console.log(`- calculation: ${analysis.metadata.calculationVersion}`);
  console.log(`- primary outcome: ${analysis.metadata.primaryOutcome}`);
  console.log(`- qa: ${analysis.qa.passed ? "passed" : "failed"}`);
  console.log(`- ${analysis.metadata.populationsDiffer}`);
  console.log("- Rates describe the supplied catalog and SSA file. They are not copied from the public index.");

  for (const metric of analysis.screenMetrics) {
    if (metric.metricKind !== "new_introductions_per_1000" || metric.variantLabel !== "steve_family") {
      continue;
    }

    console.log(`- ${metric.medium} ${metric.decade} steve_family introductions per 1000: ${metric.rate ?? "null"}`);
  }

  if (!analysis.qa.passed) {
    for (const check of analysis.qa.checks.filter((item) => !item.passed)) {
      console.error(`- fail ${check.name}: ${check.detail}`);
    }

    throw new Error("Study QA failed.");
  }

  if (!write) {
    console.log("- wrote nothing");
    return;
  }

  const destination = path.join(outRoot, analysis.metadata.studyId, "analysis");
  assertPrivateResearchPath(repoRoot, outRoot);
  assertPrivateResearchPath(repoRoot, destination);
  await mkdir(destination, { recursive: true });

  for (const name of STUDY_EXPORT_FILES) {
    await writeFile(path.join(destination, name), analysis.files[name]);
  }

  console.log(`- wrote ${destination}`);
}

const entry = process.argv[1] ?? "";

if (entry.includes("build-study")) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Study analysis failed.");
    console.error(message);
    process.exit(1);
  });
}
