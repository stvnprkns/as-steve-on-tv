import { readFile, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";

import { getCutoutRecordPath } from "@/src/lib/cutout/paths";
import { loadCutouts } from "@/src/lib/content/load-cutouts";
import { steveCutoutSchema } from "@/src/lib/schema/cutout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cutouts = await loadCutouts();
  const existing = cutouts.find((cutout) => cutout.id === id);
  if (!existing) {
    return NextResponse.json({ error: "Cutout not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    status?: string;
    displayAllowed?: boolean;
  };

  try {
    const next = steveCutoutSchema.parse({
      ...existing,
      status: body.status ?? existing.status,
      imageRights: {
        ...existing.imageRights,
        displayAllowed: body.displayAllowed ?? existing.imageRights.displayAllowed,
        reviewedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    });

    await writeFile(getCutoutRecordPath(id), `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return NextResponse.json({ cutout: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cutout update failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const raw = await readFile(getCutoutRecordPath(id), "utf8");
    return NextResponse.json({ cutout: steveCutoutSchema.parse(JSON.parse(raw) as unknown) });
  } catch {
    return NextResponse.json({ error: "Cutout not found." }, { status: 404 });
  }
}
