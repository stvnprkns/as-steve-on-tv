import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { auditStudyExport } from "../src/lib/data/study-analysis";

const USAGE = "Pass --dir pointing at a study analysis export. The command re-reads the aggregate files and exits 1 when QA fails.";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? undefined : process.argv[index + 1];

  if (!value || value.startsWith("--")) {
    return undefined;
  }

  return value;
}

async function main() {
  const dir = readArg("--dir");

  if (!dir) {
    throw new Error(USAGE);
  }

  const resolved = path.resolve(dir);
  const names = await readdir(resolved);
  const files: Record<string, string> = {};

  for (const name of names) {
    const full = path.join(resolved, name);
    const info = await stat(full);

    if (!info.isFile()) {
      continue;
    }

    files[name] = await readFile(full, "utf8");
  }

  const qa = auditStudyExport(files);

  for (const check of qa.checks) {
    console.log(`- ${check.passed ? "pass" : "fail"} ${check.name}: ${check.detail}`);
  }

  console.log(qa.passed ? "Study QA passed." : "Study QA failed.");

  if (!qa.passed) {
    process.exitCode = 1;
  }
}

const entry = process.argv[1] ?? "";

if (entry.includes("audit-study")) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Study QA failed.");
    console.error(message);
    process.exit(1);
  });
}
