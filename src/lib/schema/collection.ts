import { z } from "zod";

import { idSchema, seoFieldsSchema, slugSchema, stringArraySchema, timestampFieldsSchema } from "@/src/lib/schema/common";
import { collectionTypeSchema, contentStatusSchema } from "@/src/lib/schema/taxonomy";

export const collectionSchema = z
  .object({
    id: idSchema,
    slug: slugSchema,
    title: z.string().min(4).max(140),
    dek: z.string().min(20).max(220),
    thesis: z.string().min(80).max(900),
    entryIds: z.array(idSchema).min(2),
    collectionType: collectionTypeSchema,
    tags: stringArraySchema.default([]),
    status: contentStatusSchema
  })
  .merge(seoFieldsSchema)
  .merge(timestampFieldsSchema)
  .strict();

export type Collection = z.infer<typeof collectionSchema>;

