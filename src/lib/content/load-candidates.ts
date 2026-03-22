import { ZodError } from "zod";

import { candidateEntrySchema, type CandidateEntry } from "@/src/lib/schema";
import { getContentPath, readJsonFilesFromDirectory } from "@/src/lib/utils/fs";

function ensureUniqueCandidates(candidates: CandidateEntry[]) {
  const idSet = new Set<string>();
  const slugSet = new Set<string>();

  for (const candidate of candidates) {
    if (idSet.has(candidate.id)) {
      throw new Error(`Duplicate candidate id detected: ${candidate.id}`);
    }

    if (slugSet.has(candidate.slug)) {
      throw new Error(`Duplicate candidate slug detected: ${candidate.slug}`);
    }

    idSet.add(candidate.id);
    slugSet.add(candidate.slug);
  }
}

export async function loadCandidates(): Promise<CandidateEntry[]> {
  const rows = await readJsonFilesFromDirectory<unknown>(getContentPath("candidates"));
  const candidates = rows.map(({ absolutePath, data }) => {
    try {
      return candidateEntrySchema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error(
          `Candidate validation failed for ${absolutePath}: ${error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`
        );
      }

      throw error;
    }
  });

  ensureUniqueCandidates(candidates);

  return candidates.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
