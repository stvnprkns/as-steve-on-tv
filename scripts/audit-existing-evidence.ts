import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(repoRoot, "docs", "evidence-audit.md");
const scanRoot = path.join(repoRoot, "content");

type RecordContext = {
  id?: string;
  slug?: string;
  displayName?: string;
  subjectName?: string;
  medium?: string;
  entryType?: string;
  nameVariant?: string;
  verificationStatus?: string;
  status?: string;
  notesOnUncertainty?: string;
  matchReason?: string;
  titleOfWork?: string;
};

type EvidenceHit = {
  file: string;
  jsonPath: string;
  field: string;
  url: string;
  context: RecordContext;
};

type OtherHit = {
  file: string;
  jsonPath: string;
  field: string;
  value: string;
  context: RecordContext;
};

type AuthoredRecord = {
  file: string;
  context: RecordContext;
  evidenceUrls: string[];
};

const CONTEXT_KEYS = [
  "id",
  "slug",
  "displayName",
  "subjectName",
  "medium",
  "entryType",
  "nameVariant",
  "verificationStatus",
  "status",
  "notesOnUncertainty",
  "matchReason",
  "titleOfWork"
] as const;

function isFixtureUrl(url: string) {
  return url.includes("example.com");
}

function rel(filePath: string) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

async function listJsonFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listJsonFiles(fullPath);
      }

      return entry.isFile() && entry.name.endsWith(".json") ? [fullPath] : [];
    })
  );

  return files.flat().sort();
}

function takeContext(record: Record<string, unknown>, inherited: RecordContext): RecordContext {
  const context: RecordContext = { ...inherited };

  for (const key of CONTEXT_KEYS) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      context[key] = value;
    }
  }

  return context;
}

function recordLabel(context: RecordContext, file: string) {
  return context.displayName ?? context.subjectName ?? context.slug ?? context.id ?? path.basename(file);
}

function scanValue(value: unknown, jsonPath: string, inherited: RecordContext, file: string, evidence: EvidenceHit[], other: OtherHit[]) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => scanValue(item, `${jsonPath}[${index}]`, inherited, file, evidence, other));
    return;
  }

  const record = value as Record<string, unknown>;
  const context = takeContext(record, inherited);

  if (typeof record.evidenceUrl === "string") {
    evidence.push({
      file,
      jsonPath: `${jsonPath}.evidenceUrl`,
      field: "evidenceUrl",
      url: record.evidenceUrl,
      context
    });
  }

  if (Array.isArray(record.evidenceLinks)) {
    record.evidenceLinks.forEach((link, index) => {
      if (!link || typeof link !== "object" || typeof (link as { url?: unknown }).url !== "string") {
        return;
      }

      evidence.push({
        file,
        jsonPath: `${jsonPath}.evidenceLinks[${index}].url`,
        field: "evidenceLinks.url",
        url: (link as { url: string }).url,
        context
      });
    });
  }

  if (typeof record.contactEmail === "string" && isFixtureUrl(record.contactEmail)) {
    other.push({
      file,
      jsonPath: `${jsonPath}.contactEmail`,
      field: "contactEmail",
      value: record.contactEmail,
      context
    });
  }

  for (const [key, child] of Object.entries(record)) {
    if (key === "evidenceLinks" || !child || typeof child !== "object") {
      continue;
    }

    scanValue(child, `${jsonPath}.${key}`, context, file, evidence, other);
  }
}

function authoredNotes(record: AuthoredRecord): string[] {
  const notes: string[] = [];
  const { context, evidenceUrls } = record;

  if (context.medium) {
    notes.push(`Medium \`${context.medium}\` is the authored value.`);
  }

  if (context.medium === "commercial") {
    notes.push(
      "This commercial label is editorial. Phase 1 ingest does not infer commercial from IMDb titleType `short`, `video`, or `videoGame`."
    );
  }

  if (context.entryType) {
    notes.push(`Entry type \`${context.entryType}\`.`);
  }

  if (context.nameVariant) {
    notes.push(`Name variant \`${context.nameVariant}\`.`);
  }

  if (context.verificationStatus) {
    notes.push(`Verification status \`${context.verificationStatus}\`.`);
  }

  if (context.status) {
    notes.push(`Status \`${context.status}\`.`);
  }

  if (context.matchReason) {
    notes.push(`Hand-authored match note: ${context.matchReason}`);
  }

  if (context.notesOnUncertainty) {
    notes.push(`Uncertainty note: ${context.notesOnUncertainty}`);
  }

  if (evidenceUrls.length === 0) {
    notes.push("No evidence URL is stored on this record.");
  } else if (evidenceUrls.every((url) => isFixtureUrl(url))) {
    notes.push("Every evidence URL is an example.com placeholder. It stays in place.");
  } else {
    const fixtures = evidenceUrls.filter((url) => isFixtureUrl(url)).length;
    notes.push(`${fixtures} of ${evidenceUrls.length} evidence URLs use example.com.`);
  }

  return notes;
}

function markdownCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function render(evidence: EvidenceHit[], other: OtherHit[], authored: AuthoredRecord[]) {
  const fixtureEvidence = evidence.filter((hit) => isFixtureUrl(hit.url));
  const otherEvidence = evidence.filter((hit) => !isFixtureUrl(hit.url));
  const lines: string[] = [
    "# Evidence audit",
    "",
    "Generated by `npm run data:audit`. The command reads JSON under `content/` and rewrites this report. It does not edit entries, submissions, candidates, collections, ingest runs, or public JSON.",
    "",
    "Placeholder `example.com` URLs are already flagged at read time by `isFixtureUrl` in `src/lib/archive.ts`. This audit lists them. It does not delete, replace, or demote those records.",
    "",
    "## Counts",
    "",
    `- JSON files scanned: ${authored.length}`,
    `- Evidence URLs found: ${evidence.length}`,
    `- Evidence URLs on example.com: ${fixtureEvidence.length}`,
    `- Evidence URLs on other hosts: ${otherEvidence.length}`,
    `- Other example.com strings (not evidence URLs): ${other.length}`,
    "",
    "## Example.com evidence URLs",
    ""
  ];

  if (fixtureEvidence.length === 0) {
    lines.push("None.", "");
  } else {
    lines.push("| File | Record | Medium | Field | URL |", "| --- | --- | --- | --- | --- |");

    for (const hit of fixtureEvidence) {
      lines.push(
        `| \`${markdownCell(rel(hit.file))}\` | ${markdownCell(recordLabel(hit.context, hit.file))} | ${markdownCell(hit.context.medium ?? "—")} | \`${hit.field}\` | ${markdownCell(hit.url)} |`
      );
    }

    lines.push("");
  }

  if (otherEvidence.length > 0) {
    lines.push("## Other evidence URLs", "", "| File | Record | URL |", "| --- | --- | --- |");

    for (const hit of otherEvidence) {
      lines.push(`| \`${markdownCell(rel(hit.file))}\` | ${markdownCell(recordLabel(hit.context, hit.file))} | ${markdownCell(hit.url)} |`);
    }

    lines.push("");
  }

  lines.push("## Medium and match notes", "");
  lines.push(
    "Published entries and submissions do not store an IMDb `titleType` or a bulk-ingest match reason. Their mediums are editorial. The old ingest defects — mapping `short` and `video` to commercial, and treating a performer name or crew job as a fictional Steve — are not baked into these files. Candidate files below are hand-authored and were not rewritten.",
    ""
  );

  const noteRecords = authored.filter((record) => {
    const file = rel(record.file);
    return file.startsWith("content/entries/") || file.startsWith("content/submissions/") || file.startsWith("content/candidates/");
  });

  for (const record of noteRecords) {
    const label = recordLabel(record.context, record.file);
    lines.push(`### ${label}`, "", `\`${rel(record.file)}\``, "");

    for (const note of authoredNotes(record)) {
      lines.push(`- ${note}`);
    }

    lines.push("");
  }

  lines.push(
    "## Public copies",
    "",
    "Files under `content/public/` repeat the authored evidence URLs, including `content/public/archive-manifest.json`. They were not regenerated or edited.",
    ""
  );

  if (other.length > 0) {
    lines.push("## Example.com strings that are not evidence URLs", "", "| File | Field | Value |", "| --- | --- | --- |");

    for (const hit of other) {
      lines.push(`| \`${markdownCell(rel(hit.file))}\` | \`${hit.field}\` | ${markdownCell(hit.value)} |`);
    }

    lines.push("");
  }

  lines.push(
    "## Left unchanged",
    "",
    "No entry, submission, candidate, or public JSON file was modified. Placeholder evidence remains a verification gap for a later, human review. Phase 1 does not invent replacement sources.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

async function main() {
  const files = await listJsonFiles(scanRoot);
  const evidence: EvidenceHit[] = [];
  const other: OtherHit[] = [];
  const authored: AuthoredRecord[] = [];

  for (const file of files) {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    const before = evidence.length;
    scanValue(parsed, "$", {}, file, evidence, other);
    const evidenceUrls = evidence.slice(before).map((hit) => hit.url);
    const context =
      parsed && typeof parsed === "object" && !Array.isArray(parsed) ? takeContext(parsed as Record<string, unknown>, {}) : {};

    authored.push({ file, context, evidenceUrls });
  }

  evidence.sort((left, right) => rel(left.file).localeCompare(rel(right.file)) || left.jsonPath.localeCompare(right.jsonPath));
  other.sort((left, right) => rel(left.file).localeCompare(rel(right.file)) || left.jsonPath.localeCompare(right.jsonPath));
  authored.sort((left, right) => rel(left.file).localeCompare(rel(right.file)));

  const markdown = render(evidence, other, authored);

  if (!reportPath.startsWith(path.join(repoRoot, "docs") + path.sep)) {
    throw new Error("Refusing to write the evidence audit outside docs/.");
  }

  await writeFile(reportPath, markdown, "utf8");
  const fixtureCount = evidence.filter((hit) => isFixtureUrl(hit.url)).length;
  console.log("Evidence audit wrote docs/evidence-audit.md.");
  console.log(`- json files: ${authored.length}`);
  console.log(`- example.com evidence URLs: ${fixtureCount}`);
  console.log("- content JSON was not modified");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Evidence audit failed.");
  console.error(message);
  process.exit(1);
});
