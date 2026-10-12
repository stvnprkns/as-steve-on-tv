import { NextResponse } from "next/server";

import { loadCutouts } from "@/src/lib/content/load-cutouts";
import { publicCutoutAllowed, readCutoutAsset } from "@/src/lib/cutout/serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cutout = (await loadCutouts()).find((row) => row.id === id);
  if (!cutout || !publicCutoutAllowed(cutout, "cutout")) {
    return NextResponse.json({ error: "This Steve is not on the public collage." }, { status: 404 });
  }

  try {
    const asset = await readCutoutAsset(cutout, "cutout");
    return new NextResponse(Uint8Array.from(asset.bytes), {
      headers: {
        "Content-Type": asset.type,
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch {
    return NextResponse.json({ error: "Cutout file is missing." }, { status: 404 });
  }
}
