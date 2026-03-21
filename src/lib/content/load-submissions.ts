import { ZodError } from "zod";

import { submissionSchema, type Submission } from "@/src/lib/schema";
import { readJsonFilesFromDirectory, getContentPath } from "@/src/lib/utils/fs";

function ensureUniqueSubmissions(submissions: Submission[]) {
  const idSet = new Set<string>();

  for (const submission of submissions) {
    if (idSet.has(submission.id)) {
      throw new Error(`Duplicate submission id detected: ${submission.id}`);
    }

    idSet.add(submission.id);
  }
}

export async function loadSubmissions(): Promise<Submission[]> {
  const rows = await readJsonFilesFromDirectory<unknown>(getContentPath("submissions"));
  const submissions = rows.map(({ absolutePath, data }) => {
    try {
      return submissionSchema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error(
          `Submission validation failed for ${absolutePath}: ${error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`
        );
      }

      throw error;
    }
  });

  ensureUniqueSubmissions(submissions);

  return submissions.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}
