import { z } from "zod";

import {
  archetypeTagSchema,
  confidenceSchema,
  contentStatusSchema,
  entryTypeSchema,
  fieldSourceSchema,
  eraTagSchema,
  mediumSchema,
  nameVariantSchema,
  publicRecordStatusSchema,
  steveEnergySchema,
  toneTagSchema
} from "@/src/lib/schema/taxonomy";
import {
  idSchema,
  isoDateTimeSchema,
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
    summary: z.string().min(20).max(200),
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
    verificationStatus: publicRecordStatusSchema,
    communitySignals: z
      .object({
        confirmations: z.number().int().gte(0),
        disputes: z.number().int().gte(0),
        evidenceLinks: z.number().int().gte(0)
      })
      .strict(),
    evidenceLinks: z
      .array(
        z
          .object({
            label: z.string().min(2).max(120),
            url: z.string().url()
          })
          .strict()
      )
      .default([]),
    appearanceContext: z.string().min(12).max(280).optional(),
    notesOnUncertainty: z.string().min(12).max(280).optional(),
    sourceNotes: stringArraySchema.default([]),
    fieldSources: z
      .object({
        displayName: fieldSourceSchema.optional(),
        titleOfWork: fieldSourceSchema.optional(),
        actorOrPerson: fieldSourceSchema.optional(),
        medium: fieldSourceSchema.optional(),
        yearStart: fieldSourceSchema.optional(),
        yearEnd: fieldSourceSchema.optional(),
        image: fieldSourceSchema.optional(),
        summary: fieldSourceSchema.optional(),
        synopsis: fieldSourceSchema.optional(),
        editorialBlurb: fieldSourceSchema.optional(),
        whyItMatters: fieldSourceSchema.optional(),
        verificationStatus: fieldSourceSchema.optional()
      })
      .strict()
      .optional(),
    externalRefs: z
      .object({
        imdbTitleId: z.string().min(2).max(32).optional(),
        imdbNameId: z.string().min(2).max(32).optional(),
        secondaryId: z.string().min(2).max(64).optional()
      })
      .strict()
      .optional(),
    derivedFromCandidateId: idSchema.optional(),
    lastVerifiedAt: isoDateTimeSchema.optional(),
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
