import { NextResponse } from "next/server";

import { publishCandidateAndRefreshArtifacts } from "@/src/lib/content/publish";
import { applyRevalidation } from "@/src/lib/revalidation";
import type { SteveEntry } from "@/src/lib/schema";

function isAuthorized(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    candidateId?: string;
    overrides?: Partial<SteveEntry>;
  };

  if (!payload.candidateId) {
    return NextResponse.json({ ok: false, error: "candidateId is required" }, { status: 400 });
  }

  const result = await publishCandidateAndRefreshArtifacts(payload.candidateId, payload.overrides);
  await applyRevalidation({
    tags: [
      "archive",
      `entry:${result.publishedEntry.slug}`,
      ...result.changedCollectionSlugs.map((slug) => `collection:${slug}`)
    ],
    slugs: [result.publishedEntry.slug, ...result.changedEntrySlugs],
    collectionSlugs: result.changedCollectionSlugs
  });

  return NextResponse.json({
    ok: true,
    publishedEntry: result.publishedEntry.slug,
    changedEntrySlugs: result.changedEntrySlugs,
    changedCollectionSlugs: result.changedCollectionSlugs
  });
}
