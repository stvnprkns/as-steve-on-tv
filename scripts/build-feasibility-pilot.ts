import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runFeasibilityPilot } from "../src/lib/data/coverage";
import { assertPrivateResearchPath, assertStudyCatalogPath } from "../src/lib/data/research-paths";
import { studyCatalogSchema } from "../src/lib/schema";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const USAGE =
  "Pass --catalog pointing at a private JSON catalog of titles, principals, episodes, and names. The feasibility pilot writes completeness and matching counts. It does not calculate a Steve rate.";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? undefined : process.argv[index + 1];

  if (!value || value.startsWith("--")) {
    return undefined;
  }

  return value;
}

async function main() {
  const catalogPath = readArg("--catalog");
  const write = process.argv.includes("--write");
  const outRoot = path.resolve(readArg("--out") ?? path.join(repoRoot, "research", "private", "studies"));

  if (!catalogPath) {
    throw new Error(USAGE);
  }

  assertStudyCatalogPath(repoRoot, catalogPath);
  const catalog = studyCatalogSchema.parse(JSON.parse(await readFile(catalogPath, "utf8")));
  const pilot = runFeasibilityPilot({ catalog, now: new Date().toISOString() });
  const heading = write ? "Feasibility pilot completed." : "Feasibility pilot dry run complete.";

  console.log(heading);
  console.log(`- study: ${pilot.population.id}`);
  console.log(`- approved status: ${pilot.population.approvedStatus}`);
  console.log("- primary outcome calculated: false");
  console.log(`- selected works: ${pilot.selections.filter((selection) => selection.included).length}`);
  console.log(`- eligible named credits: ${pilot.credits.filter((credit) => credit.eligible).length}`);
  console.log(`- introductions with a debut year: ${pilot.introductions.length}`);
  console.log(`- ${pilot.report.note}`);
  console.log(pilot.csv.trimEnd());

  if (!write) {
    console.log("- wrote nothing");
    return;
  }

  assertPrivateResearchPath(repoRoot, outRoot);
  const destination = path.join(outRoot, pilot.population.id);
  assertPrivateResearchPath(repoRoot, destination);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "feasibility-completeness.csv"), pilot.csv);
  await writeFile(path.join(destination, "feasibility-qa.json"), `${JSON.stringify(pilot.report, null, 2)}\n`);
  await writeFile(path.join(destination, "selections.jsonl"), jsonl(pilot.selections));
  await writeFile(path.join(destination, "credits.jsonl"), jsonl(pilot.credits));
  await writeFile(path.join(destination, "introductions.jsonl"), jsonl(pilot.introductions));
  await writeFile(path.join(destination, "exclusions.jsonl"), jsonl(pilot.exclusions));
  console.log(`- wrote ${destination}`);
}

function jsonl(rows: readonly unknown[]): string {
  return rows.length === 0 ? "" : `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

const entry = process.argv[1] ?? "";

if (entry.includes("build-feasibility-pilot")) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Feasibility pilot failed.");
    console.error(message);
    process.exit(1);
  });
}
