import { z } from "zod";

import { idSchema, isoDateTimeSchema, slugSchema, timestampFieldsSchema } from "@/src/lib/schema/common";

export const cutoutCropTypes = ["face", "upper-body"] as const;
export const cutoutStatuses = ["draft", "reviewed", "collage-ready", "rejected"] as const;
export const cutoutProviders = ["remove.bg", "passthrough", "fixture"] as const;

export const pixelBoxSchema = z
  .object({
    x: z.number().int().gte(0),
    y: z.number().int().gte(0),
    width: z.number().int().positive(),
    height: z.number().int().positive()
  })
  .strict();

export const steveCutoutSchema = z
  .object({
    id: idSchema,
    slug: slugSchema,
    displayName: z.string().min(2).max(120),
    entryId: idSchema.optional(),
    cropType: z.enum(cutoutCropTypes),
    status: z.enum(cutoutStatuses),
    provider: z.enum(cutoutProviders),
    source: z
      .object({
        title: z.string().min(2).max(160),
        url: z.string().url().optional(),
        attribution: z.string().min(2).max(240).optional(),
        capturedAt: isoDateTimeSchema.optional(),
        notes: z.string().min(4).max(400).optional()
      })
      .strict(),
    selection: pixelBoxSchema.optional(),
    trimmedBox: pixelBoxSchema,
    assets: z
      .object({
        original: z.string().min(1),
        cutout: z.string().min(1),
        mask: z.string().min(1)
      })
      .strict(),
    imageRights: z
      .object({
        displayAllowed: z.boolean(),
        licenseBasis: z.string().min(2).max(160),
        attribution: z.string().min(2).max(240).optional(),
        sourceUrl: z.string().url().optional(),
        reviewedAt: isoDateTimeSchema.optional()
      })
      .strict(),
    synthetic: z.boolean().optional()
  })
  .merge(timestampFieldsSchema)
  .strict();

export type PixelBox = z.infer<typeof pixelBoxSchema>;
export type SteveCutout = z.infer<typeof steveCutoutSchema>;

export function isPublicCollageCutout(cutout: SteveCutout) {
  return cutout.status === "collage-ready" && cutout.imageRights.displayAllowed;
}
