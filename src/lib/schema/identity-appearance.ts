import { z } from "zod";

import { idSchema, isoDateTimeSchema, timestampFieldsSchema } from "@/src/lib/schema/common";
import { nameVariantSchema } from "@/src/lib/schema/taxonomy";

export const reviewDispositions = [
  "new_identity",
  "new_appearance",
  "duplicate",
  "out_of_scope",
  "needs_evidence"
] as const;

export const reviewDispositionSchema = z.enum(reviewDispositions);

export const workTypes = ["film", "tv_series", "tv_episode", "commercial", "unknown"] as const;
export const identityRepresentations = ["fictional", "self", "persona"] as const;
export const mergeStatuses = ["unmerged", "merged_into", "split"] as const;
export const evidenceStrengths = ["high", "medium", "low"] as const;

export const workIdentitySchema = z
  .object({
    id: idSchema,
    workType: z.enum(workTypes),
    title: z.string().min(1).max(200),
    releaseYear: z.number().int().gte(1888).lte(2100).optional(),
    firstAirDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    region: z.string().min(2).max(80).optional(),
    language: z.string().min(2).max(40).optional(),
    provenance: z.string().min(2).max(160),
    externalRefs: z
      .array(
        z
          .object({
            provider: z.string().min(2).max(64),
            providerId: z.string().min(2).max(64)
          })
          .strict()
      )
      .default([])
  })
  .merge(timestampFieldsSchema)
  .strict();

export const characterIdentitySchema = z
  .object({
    id: idSchema,
    creditedName: z.string().min(2).max(160),
    canonicalName: z.string().min(2).max(160),
    normalizedName: z.string().min(2).max(160),
    nameVariant: nameVariantSchema,
    representation: z.enum(identityRepresentations),
    mergeStatus: z.enum(mergeStatuses),
    mergedIntoId: idSchema.optional(),
    originPerformerId: z.string().min(2).max(64).optional(),
    originWorkId: z.string().min(2).max(64).optional()
  })
  .merge(timestampFieldsSchema)
  .strict();

export const characterAppearanceSchema = z
  .object({
    id: idSchema,
    workId: idSchema,
    characterId: idSchema,
    performerId: z.string().min(2).max(64).optional(),
    performerName: z.string().min(2).max(160).optional(),
    creditedText: z.string().min(1).max(200),
    sourceId: idSchema.optional(),
    appearanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    namedCredit: z.boolean(),
    evidenceStrength: z.enum(evidenceStrengths),
    reviewState: z.enum(["proposed", "verified", "rejected"]),
    dedupeKey: z.string().min(8).max(240)
  })
  .merge(timestampFieldsSchema)
  .strict();

export type ReviewDisposition = z.infer<typeof reviewDispositionSchema>;
export type WorkIdentity = z.infer<typeof workIdentitySchema>;
export type CharacterIdentity = z.infer<typeof characterIdentitySchema>;
export type CharacterAppearance = z.infer<typeof characterAppearanceSchema>;
