import path from "node:path";
import { fileURLToPath } from "node:url";

import { mkdir, writeFile } from "node:fs/promises";

import { assertStudyPublishPath } from "../src/lib/data/research-paths";
import { PUBLIC_STUDY_SLUG, STORY_SUMMARY_FILE, prepareStudyPublication } from "../src/lib/data/study-story";
import { STUDY_EXPORT_FILES } from "../src/lib/data/study-analysis";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const USAGE =
  "Pass --dir pointing at a QA-passed study analysis export. The command republishes aggregate files and a story summary. It writes only with --write, and only under content/public/studies.";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? undefined : process.argv[index + 1];

  if (!value || value.startsWith("--")) {
    return undefined;
  }

  return value;
}

async function main() {
  const sourceDir = readArg("--dir");
  const write = process.argv.includes("--write");
  const destination = path.resolve(readArg("--out") ?? path.join(repoRoot, "content", "public", "studies", PUBLIC_STUDY_SLUG));

  if (!sourceDir) {
    throw new Error(USAGE);
  }

  assertStudyPublishPath(repoRoot, destination);
  const prepared = await prepareStudyPublication(path.resolve(sourceDir));
  const heading = write ? "Study publish completed." : "Study publish dry run complete.";

  console.log(heading);
  console.log(`- study: ${prepared.summary.studyId}`);
  console.log("- conclusion: none");

  if (!write) {
    console.log("- wrote nothing");
    return;
  }

  await mkdir(destination, { recursive: true });

  for (const name of STUDY_EXPORT_FILES) {
    const contents = prepared.files[name];

    if (contents === undefined) {
      throw new Error(`Study export is missing ${name}.`);
    }

    await writeFile(path.join(destination, name), contents);
  }

  await writeFile(path.join(destination, STORY_SUMMARY_FILE), `${JSON.stringify(prepared.summary, null, 2)}\n`);
  console.log(`- wrote ${destination}`);
}

const entry = process.argv[1] ?? "";

if (entry.includes("publish-study")) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Study publish failed.");
    console.error(message);
    process.exit(1);
  });
}
