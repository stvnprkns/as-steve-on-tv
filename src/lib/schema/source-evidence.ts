import { z } from "zod";

import { idSchema, isoDateTimeSchema } from "@/src/lib/schema/common";

export const reviewActionKinds = ["create", "verify", "reject", "merge", "split", "correct", "restore"] as const;

export const sourceSnapshotSchema = z
  .object({
    id: idSchema,
    sourceName: z.string().min(2).max(80),
    versionLabel: z.string().min(1).max(80).optional(),
    retrievedAt: isoDateTimeSchema,
    contentSha256: z.string().min(8).max(128).optional(),
    sourceUrl: z.string().url().optional(),
    licenseClassification: z.string().min(2).max(160),
    importedRowCounts: z.record(z.string(), z.number().int().gte(0)).default({}),
    scriptVersion: z.string().min(1).max(80).optional(),
    createdAt: isoDateTimeSchema
  })
  .strict();

export const sourceEvidenceSchema = z
  .object({
    id: idSchema,
    candidateId: idSchema.optional(),
    publishedEntryId: idSchema.optional(),
    characterId: idSchema.optional(),
    appearanceId: idSchema.optional(),
    provider: z.string().min(2).max(64),
    reference: z.string().min(2).max(300),
    assertion: z.string().min(4).max(320),
    locator: z.string().min(1).max(160).optional(),
    evidenceType: z.enum(["credit", "page", "catalog", "submission", "note"]),
    reviewStatus: z.enum(["unreviewed", "accepted", "rejected"]),
    capturedAt: isoDateTimeSchema,
    reviewedAt: isoDateTimeSchema.optional(),
    displayAllowed: z.boolean(),
    linkAllowed: z.boolean(),
    createdAt: isoDateTimeSchema
  })
  .strict();

/** Append-only. There is no updatedAt because a recorded action is not edited. */
export const reviewActionSchema = z
  .object({
    id: idSchema,
    action: z.enum(reviewActionKinds),
    moderator: z.string().min(2).max(120),
    reason: z.string().min(4).max(500),
    targetType: z.enum([
      "candidate",
      "character_identity",
      "character_appearance",
      "work_identity",
      "source_evidence",
      "published_entry"
    ]),
    targetId: idSchema,
    beforePayload: z.record(z.string(), z.unknown()).optional(),
    afterPayload: z.record(z.string(), z.unknown()).optional(),
    createdAt: isoDateTimeSchema
  })
  .strict();

export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;
export type ReviewAction = z.infer<typeof reviewActionSchema>;
