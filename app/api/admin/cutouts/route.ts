import { NextResponse } from "next/server";

import { loadCutouts } from "@/src/lib/content/load-cutouts";
import { processCutout } from "@/src/lib/cutout/process";
import { pixelBoxSchema } from "@/src/lib/schema/cutout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cutouts = await loadCutouts();
  return NextResponse.json({ cutouts });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const displayName = String(form.get("displayName") ?? "").trim();
  const sourceTitle = String(form.get("sourceTitle") ?? "").trim();

  if (!(file instanceof File) || !displayName || !sourceTitle) {
    return NextResponse.json({ error: "An image, display name, and source title are required." }, { status: 400 });
  }

  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "Keep source frames under 12MB." }, { status: 400 });
  }

  const selectionRaw = String(form.get("selection") ?? "").trim();
  let selection = undefined;
  if (selectionRaw) {
    const parsed = pixelBoxSchema.safeParse(JSON.parse(selectionRaw) as unknown);
    if (!parsed.success) {
      return NextResponse.json({ error: "Selection must be x, y, width, height." }, { status: 400 });
    }
    selection = parsed.data;
  }

  try {
    const originalBytes = Buffer.from(await file.arrayBuffer());
    const record = await processCutout({
      displayName,
      sourceTitle,
      entryId: String(form.get("entryId") ?? "").trim() || undefined,
      sourceUrl: String(form.get("sourceUrl") ?? "").trim() || undefined,
      attribution: String(form.get("attribution") ?? "").trim() || undefined,
      licenseBasis: String(form.get("licenseBasis") ?? "").trim() || "screenshot-held-for-review",
      notes: String(form.get("notes") ?? "").trim() || undefined,
      cropType: form.get("cropType") === "face" ? "face" : "upper-body",
      selection,
      originalBytes,
      originalFileName: file.name
    });

    return NextResponse.json({ cutout: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cutout processing failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
