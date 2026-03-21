import { z } from "zod";

import {
  archetypeTagSchema,
  confidenceSchema,
  contentStatusSchema,
  entryTypeSchema,
  eraTagSchema,
  mediumSchema,
  nameVariantSchema,
  steveEnergySchema,
  toneTagSchema
} from "@/src/lib/schema/taxonomy";
import {
  idSchema,
  optionalImageSchema,
  slugSchema,
  stringArraySchema,
  timestampFieldsSchema
} from "@/src/lib/schema/common";

export const steveEntrySchema = z
  .object({
    id: idSchema,
    slug: slugSchema,
    displayName: z.string().min(2).max(120),
    canonicalName: z.string().min(2).max(120),
    nameVariant: nameVariantSchema,
    entryType: entryTypeSchema,
    medium: mediumSchema,
    titleOfWork: z.string().min(1).max(160),
    franchise: z.string().min(1).max(160).optional(),
    yearStart: z.number().int().gte(1950).lte(2100),
    yearEnd: z.number().int().gte(1950).lte(2100).optional(),
    actorOrPerson: z.string().min(2).max(160),
    synopsis: z.string().min(30).max(320),
    editorialBlurb: z.string().min(80).max(700),
    whyItMatters: z.string().min(40).max(400),
    steveEnergy: steveEnergySchema,
    archetypes: z.array(archetypeTagSchema).min(1),
    era: eraTagSchema,
    tones: z.array(toneTagSchema).min(1),
    tags: stringArraySchema.min(1),
    searchAliases: stringArraySchema.default([]),
    relatedEntryIds: z.array(idSchema).default([]),
    collectionIds: z.array(idSchema).default([]),
    status: contentStatusSchema,
    confidence: confidenceSchema,
    sourceNotes: stringArraySchema.default([]),
    image: optionalImageSchema.optional()
  })
  .merge(timestampFieldsSchema)
  .strict()
  .superRefine((value, ctx) => {
    if (value.yearEnd !== undefined && value.yearEnd < value.yearStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["yearEnd"],
        message: "yearEnd must be greater than or equal to yearStart."
      });
    }
  });

export type SteveEntry = z.infer<typeof steveEntrySchema>;
