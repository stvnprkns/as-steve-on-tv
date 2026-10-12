import type { PixelBox } from "@/src/lib/schema/cutout";

export type CutoutProviderName = "remove.bg" | "passthrough" | "fixture";

export type CutoutProvider = {
  name: CutoutProviderName;
  removeBackground(image: Buffer): Promise<Buffer>;
};

const REMOVE_BG_URL = "https://api.remove.bg/v1.0/removebg";

export class RemoveBgProvider implements CutoutProvider {
  name = "remove.bg" as const;

  constructor(private readonly apiKey: string) {}

  async removeBackground(image: Buffer): Promise<Buffer> {
    const body = new FormData();
    body.set("size", "auto");
    body.set("format", "png");
    body.set("type", "person");
    body.set("crop", "true");
    body.set("image_file", new Blob([new Uint8Array(image)]), "steve.png");

    const response = await fetch(REMOVE_BG_URL, {
      method: "POST",
      headers: {
        "X-Api-Key": this.apiKey
      },
      body
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`remove.bg failed (${response.status}): ${detail.slice(0, 400)}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

export class PassthroughProvider implements CutoutProvider {
  name: "passthrough" | "fixture";

  constructor(name: "passthrough" | "fixture" = "passthrough") {
    this.name = name;
  }

  async removeBackground(image: Buffer): Promise<Buffer> {
    return image;
  }
}

export function createCutoutProvider(options?: { apiKey?: string; fixture?: boolean }): CutoutProvider {
  if (options?.fixture) {
    return new PassthroughProvider("fixture");
  }

  const apiKey = options?.apiKey ?? process.env.REMOVEBG_API_KEY;
  if (apiKey) {
    return new RemoveBgProvider(apiKey);
  }

  return new PassthroughProvider();
}

export function describeMissingProvider(selection?: PixelBox) {
  if (selection) {
    return "No REMOVEBG_API_KEY. Selection was cropped, so the file must already be a transparent PNG of Steve.";
  }

  return "No REMOVEBG_API_KEY. Upload a transparent PNG, or set the key to send the frame to remove.bg.";
}
