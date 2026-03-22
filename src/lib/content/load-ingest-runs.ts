import { ZodError } from "zod";

import { ingestRunSchema, type IngestRun } from "@/src/lib/schema";
import { getContentPath, readJsonFilesFromDirectory } from "@/src/lib/utils/fs";

function ensureUniqueIngestRuns(runs: IngestRun[]) {
  const idSet = new Set<string>();

  for (const run of runs) {
    if (idSet.has(run.id)) {
      throw new Error(`Duplicate ingest run id detected: ${run.id}`);
    }

    idSet.add(run.id);
  }
}

export async function loadIngestRuns(): Promise<IngestRun[]> {
  const rows = await readJsonFilesFromDirectory<unknown>(getContentPath("ingest-runs"));
  const runs = rows.map(({ absolutePath, data }) => {
    try {
      return ingestRunSchema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error(
          `Ingest run validation failed for ${absolutePath}: ${error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`
        );
      }

      throw error;
    }
  });

  ensureUniqueIngestRuns(runs);

  return runs.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}
