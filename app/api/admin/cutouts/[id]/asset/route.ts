import { NextResponse } from "next/server";

import { loadCutouts } from "@/src/lib/content/load-cutouts";
import { parseCutoutAssetKind, readCutoutAsset } from "@/src/lib/cutout/serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = parseCutoutAssetKind(new URL(request.url).searchParams.get("kind") ?? "cutout");
  if (!kind) {
    return NextResponse.json({ error: "Unknown asset kind." }, { status: 400 });
  }

  const cutout = (await loadCutouts()).find((row) => row.id === id);
  if (!cutout) {
    return NextResponse.json({ error: "Cutout not found." }, { status: 404 });
  }

  try {
    const asset = await readCutoutAsset(cutout, kind);
    return new NextResponse(Uint8Array.from(asset.bytes), {
      headers: {
        "Content-Type": asset.type,
        "Cache-Control": "private, max-age=60"
      }
    });
  } catch {
    return NextResponse.json({ error: "Asset file is missing." }, { status: 404 });
  }
}
