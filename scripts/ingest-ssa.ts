import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertPrivateResearchPath } from "../src/lib/data/research-paths";
import { checksumTextFiles, parseSsaTexts, parseSsaZip, ssaSummaryLines, type SsaTextFile } from "../src/lib/data/ssa";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const USAGE =
  "Pass --file pointing at the official SSA names.zip, or a directory of yobYYYY.txt files, and --release-date YYYY-MM-DD. Counts under 5 and missing years are stored as suppressed_or_absent, never as zero.";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? undefined : process.argv[index + 1];

  if (!value || value.startsWith("--")) {
    return undefined;
  }

  return value;
}

async function readSsaInput(filePath: string): Promise<{ texts?: SsaTextFile[]; zip?: Buffer }> {
  const info = await stat(filePath);

  if (info.isDirectory()) {
    const names = (await readdir(filePath)).filter((name) => /^yob\d{4}\.txt$/i.test(name));
    const texts: SsaTextFile[] = [];

    for (const name of names.sort()) {
      texts.push({ name, text: await readFile(path.join(filePath, name), "utf8") });
    }

    return { texts };
  }

  return { zip: await readFile(filePath) };
}

async function main() {
  const filePath = readArg("--file");
  const releaseDate = readArg("--release-date");
  const write = process.argv.includes("--write");
  const outRoot = path.resolve(readArg("--out") ?? path.join(repoRoot, "research", "private", "ssa"));

  if (!filePath || !releaseDate) {
    throw new Error(USAGE);
  }

  let input: { texts?: SsaTextFile[]; zip?: Buffer };

  try {
    input = await readSsaInput(filePath);
  } catch {
    throw new Error(`Missing SSA file: ${filePath}`);
  }

  const retrievedAt = new Date().toISOString();
  const imported = input.zip
    ? parseSsaZip(input.zip, { releaseDate, retrievedAt })
    : parseSsaTexts(input.texts ?? [], {
        releaseDate,
        retrievedAt,
        contentSha256: checksumTextFiles(input.texts ?? [])
      });

  const heading = write ? "SSA import completed." : "SSA import dry run complete.";
  console.log(heading);

  for (const line of ssaSummaryLines(imported)) {
    console.log(`- ${line}`);
  }

  console.log("- study window: 1960-2025");
  console.log("- spellings stay separate; no combined Steve total is written");

  if (!write) {
    console.log("- wrote nothing");
    return;
  }

  assertPrivateResearchPath(repoRoot, outRoot);
  const destination = path.join(outRoot, imported.snapshot.id);
  assertPrivateResearchPath(repoRoot, destination);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "snapshot.json"), `${JSON.stringify(imported.snapshot, null, 2)}\n`);
  const lines = imported.observations.map((row) => JSON.stringify(row));
  await writeFile(path.join(destination, "birth-name-count.jsonl"), `${lines.join("\n")}\n`);
  console.log(`- wrote ${destination}`);
}

const entry = process.argv[1] ?? "";

if (entry.includes("ingest-ssa")) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("SSA import failed.");
    console.error(message);
    process.exit(1);
  });
}
