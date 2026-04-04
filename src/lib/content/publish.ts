import { refreshPublicArtifactsFromRepository } from "@/src/lib/content/public-artifacts";
import { getContentRepository } from "@/src/lib/content/repository";
import { hasDatabaseUrl } from "@/src/lib/db/pg";
import { steveEntrySchema, type SteveEntry } from "@/src/lib/schema";

async function publishCandidateById(candidateId: string, overrides?: Partial<SteveEntry>) {
  const repository = getContentRepository();
  const candidate = (await repository.listReviewQueue()).find((item) => item.id === candidateId);

  if (!candidate) {
    throw new Error(`Candidate not found: ${candidateId}`);
  }

  const publishedEntry = steveEntrySchema.parse({
    ...candidate.payload,
    ...overrides
  });

  await repository.acceptCandidate(candidate.id, publishedEntry);

  return publishedEntry;
}

export async function publishAcceptedCandidatesAndRefreshArtifacts() {
  if (!hasDatabaseUrl()) {
    throw new Error("AUTO_PUBLISH_ACCEPTED requires DATABASE_URL so accepted candidates can be written to canonical storage.");
  }

  const repository = getContentRepository();
  const candidates = await repository.listReviewQueue();
  let published = 0;
  let skipped = 0;
  const publishedSlugs: string[] = [];

  for (const candidate of candidates) {
    if (candidate.status !== "accepted") {
      continue;
    }

    try {
      const publishedEntry = await publishCandidateById(candidate.id);
      published += 1;
      publishedSlugs.push(publishedEntry.slug);
    } catch {
      skipped += 1;
    }
  }

  const refresh = await refreshPublicArtifactsFromRepository();

  return {
    published,
    skipped,
    publishedSlugs,
    ...refresh
  };
}

export async function publishCandidateAndRefreshArtifacts(candidateId: string, overrides?: Partial<SteveEntry>) {
  if (!hasDatabaseUrl()) {
    throw new Error("Candidate publishing requires DATABASE_URL so accepted candidates can be written to canonical storage.");
  }

  const publishedEntry = await publishCandidateById(candidateId, overrides);
  const refresh = await refreshPublicArtifactsFromRepository();

  return {
    publishedEntry,
    ...refresh
  };
}
