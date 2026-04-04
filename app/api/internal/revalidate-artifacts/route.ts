import { NextResponse } from "next/server";

import { applyRevalidation, type RevalidationPayload } from "@/src/lib/revalidation";

function isAuthorized(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as RevalidationPayload;
  await applyRevalidation(payload);

  return NextResponse.json({
    ok: true,
    tags: payload.tags,
    slugs: payload.slugs ?? [],
    collectionSlugs: payload.collectionSlugs ?? []
  });
}
