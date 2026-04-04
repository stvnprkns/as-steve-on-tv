import { z } from "zod";

import {
  idSchema,
  isoDateTimeSchema,
  slugSchema,
  stringArraySchema,
  timestampFieldsSchema
} from "@/src/lib/schema/common";
import {
  entryTypeSchema,
  mediumSchema,
  moderationStatusSchema,
  nameVariantSchema
} from "@/src/lib/schema/taxonomy";
import { collectionSchema } from "@/src/lib/schema/collection";
import { steveEntrySchema } from "@/src/lib/schema/steve-entry";
import { searchDocumentSchema } from "@/src/lib/search/search-types";

export const ingestProviderSchema = z.enum(["imdb_bulk", "secondary_metadata", "manual"]);
export const ingestRunStatusSchema = z.enum(["running", "completed", "failed"]);
export const detectionConfidenceSchema = z.enum(["high", "medium", "low"]);

export const sourceTitleRecordSchema = z
  .object({
    id: idSchema,
    provider: ingestProviderSchema,
    providerTitleId: z.string().min(2).max(64),
    imdbTitleId: z.string().min(2).max(32).optional(),
    secondaryId: z.string().min(2).max(64).optional(),
    title: z.string().min(1).max(200),
    medium: mediumSchema,
    yearStart: z.number().int().gte(1888).lte(2100),
    yearEnd: z.number().int().gte(1888).lte(2100).optional(),
    rawPayloadHash: z.string().min(8).max(128),
    payload: z.record(z.string(), z.unknown()).default({}),
    fetchedAt: isoDateTimeSchema
  })
  .merge(timestampFieldsSchema)
  .strict();

export const sourcePersonRecordSchema = z
  .object({
    id: idSchema,
    provider: ingestProviderSchema,
    providerPersonId: z.string().min(2).max(64),
    imdbNameId: z.string().min(2).max(32).optional(),
    displayName: z.string().min(2).max(160),
    rawPayloadHash: z.string().min(8).max(128),
    payload: z.record(z.string(), z.unknown()).default({}),
    fetchedAt: isoDateTimeSchema
  })
  .merge(timestampFieldsSchema)
  .strict();

export const candidateEntrySchema = z
  .object({
    id: idSchema,
    slug: slugSchema,
    displayName: z.string().min(2).max(120),
    canonicalName: z.string().min(2).max(120),
    matchedName: z.string().min(2).max(120),
    nameVariant: nameVariantSchema,
    entryType: entryTypeSchema,
    medium: mediumSchema,
    titleOfWork: z.string().min(1).max(160),
    actorOrPerson: z.string().min(2).max(160),
    yearStart: z.number().int().gte(1888).lte(2100),
    yearEnd: z.number().int().gte(1888).lte(2100).optional(),
    matchConfidence: detectionConfidenceSchema,
    matchReason: z.string().min(20).max(320),
    status: moderationStatusSchema,
    imdbTitleId: z.string().min(2).max(32).optional(),
    imdbNameId: z.string().min(2).max(32).optional(),
    secondaryId: z.string().min(2).max(64).optional(),
    sourceTitleId: idSchema,
    sourcePersonId: idSchema.optional(),
    linkedPublishedEntryId: idSchema.nullable(),
    notesOnUncertainty: z.string().min(12).max(280).optional(),
    payload: z.record(z.string(), z.unknown()).default({}),
    evidenceLabels: stringArraySchema.default([])
  })
  .merge(timestampFieldsSchema)
  .strict();

export const ingestRunSchema = z
  .object({
    id: idSchema,
    provider: ingestProviderSchema,
    status: ingestRunStatusSchema,
    datasetFingerprint: z.string().min(8).max(128).optional(),
    recordsScanned: z.number().int().gte(0),
    candidatesCreated: z.number().int().gte(0),
    candidatesUpdated: z.number().int().gte(0).default(0),
    candidatesMerged: z.number().int().gte(0).default(0),
    candidatesSkipped: z.number().int().gte(0).default(0),
    notes: z.string().min(4).max(500).optional(),
    startedAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema.optional()
  })
  .merge(timestampFieldsSchema)
  .strict();

export const publicArchiveManifestSchema = z
  .object({
    generatedAt: isoDateTimeSchema,
    datasetFingerprint: z.string().min(8).max(128).optional(),
    etag: z.string().min(8).max(128),
    entryCount: z.number().int().gte(0),
    counts: z
      .object({
        total: z.number().int().gte(0),
        verified: z.number().int().gte(0),
        unresolved: z.number().int().gte(0),
        latestFiledAt: isoDateTimeSchema.nullable()
      })
      .strict(),
    entries: z.array(steveEntrySchema),
    collections: z.array(collectionSchema)
  })
  .strict();

export const publicSearchArtifactSchema = z
  .object({
    generatedAt: isoDateTimeSchema,
    etag: z.string().min(8).max(128),
    documents: z.array(searchDocumentSchema)
  })
  .strict();

export const publicListArtifactSchema = z
  .object({
    generatedAt: isoDateTimeSchema,
    etag: z.string().min(8).max(128),
    sort: z.enum(["canon", "newest", "needs-verification"]),
    entries: z.array(steveEntrySchema)
  })
  .strict();

export type IngestProvider = z.infer<typeof ingestProviderSchema>;
export type DetectionConfidence = z.infer<typeof detectionConfidenceSchema>;
export type SourceTitleRecord = z.infer<typeof sourceTitleRecordSchema>;
export type SourcePersonRecord = z.infer<typeof sourcePersonRecordSchema>;
export type CandidateEntry = z.infer<typeof candidateEntrySchema>;
export type IngestRun = z.infer<typeof ingestRunSchema>;
export type PublicArchiveManifest = z.infer<typeof publicArchiveManifestSchema>;
export type PublicSearchArtifact = z.infer<typeof publicSearchArtifactSchema>;
export type PublicListArtifact = z.infer<typeof publicListArtifactSchema>;
