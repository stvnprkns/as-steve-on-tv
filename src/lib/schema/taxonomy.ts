import { z } from "zod";

export const nameVariants = ["steve", "stephen", "steven", "stevie"] as const;
export const mediums = ["tv", "film", "commercial"] as const;
export const entryTypes = ["character", "person", "persona"] as const;
export const contentStatuses = [
  "draft",
  "review",
  "published",
  "withheld",
  "deprecated"
] as const;
export const moderationStatuses = [
  "pending_review",
  "under_review",
  "accepted",
  "rejected",
  "merged",
  "needs_more_evidence"
] as const;
export const collectionTypes = [
  "editorial",
  "ranked_editorial",
  "archetype",
  "seasonal",
  "starter_pack"
] as const;
export const submissionTypes = ["report", "confirm", "dispute", "evidence", "correction"] as const;
export const confidenceLevels = ["high", "medium", "disputed"] as const;
export const publicRecordStatuses = [
  "verified",
  "community_confirmed",
  "needs_verification",
  "disputed",
  "corrected"
] as const;
export const steveEnergyLevels = [
  "steady",
  "chaotic",
  "magnetic",
  "weaponized",
  "mythic"
] as const;
export const archetypeTags = [
  "chaos-engine",
  "nostalgia-core",
  "cool-older-brother",
  "corporate-spokesman",
  "auteur-captain",
  "recurring-chaos",
  "earnest-anchor",
  "slick-operator",
  "sitcom-neighbor",
  "mall-warrior",
  "deadpan-observer",
  "outsider-icon"
] as const;
export const eraTags = [
  "1950s",
  "1960s",
  "1970s",
  "1980s",
  "1990s",
  "2000s",
  "2010s",
  "2020s"
] as const;
export const toneTags = [
  "earnest",
  "chaotic",
  "wholesome",
  "slick",
  "melancholy",
  "absurd",
  "iconic",
  "warm",
  "deadpan",
  "intense"
] as const;

export const nameVariantSchema = z.enum(nameVariants);
export const mediumSchema = z.enum(mediums);
export const entryTypeSchema = z.enum(entryTypes);
export const contentStatusSchema = z.enum(contentStatuses);
export const moderationStatusSchema = z.enum(moderationStatuses);
export const collectionTypeSchema = z.enum(collectionTypes);
export const submissionTypeSchema = z.enum(submissionTypes);
export const confidenceSchema = z.enum(confidenceLevels);
export const publicRecordStatusSchema = z.enum(publicRecordStatuses);
export const steveEnergySchema = z.enum(steveEnergyLevels);
export const archetypeTagSchema = z.enum(archetypeTags);
export const eraTagSchema = z.enum(eraTags);
export const toneTagSchema = z.enum(toneTags);

export const taxonomyDataSchema = z
  .object({
    nameVariants: z.array(nameVariantSchema),
    mediums: z.array(mediumSchema),
    entryTypes: z.array(entryTypeSchema),
    contentStatuses: z.array(contentStatusSchema),
    moderationStatuses: z.array(moderationStatusSchema),
    collectionTypes: z.array(collectionTypeSchema),
    submissionTypes: z.array(submissionTypeSchema),
    confidenceLevels: z.array(confidenceSchema),
    publicRecordStatuses: z.array(publicRecordStatusSchema),
    steveEnergyLevels: z.array(steveEnergySchema),
    archetypeTags: z.array(archetypeTagSchema),
    eraTags: z.array(eraTagSchema),
    toneTags: z.array(toneTagSchema)
  })
  .strict();

export type NameVariant = z.infer<typeof nameVariantSchema>;
export type Medium = z.infer<typeof mediumSchema>;
export type EntryType = z.infer<typeof entryTypeSchema>;
export type ContentStatus = z.infer<typeof contentStatusSchema>;
export type ModerationStatus = z.infer<typeof moderationStatusSchema>;
export type CollectionType = z.infer<typeof collectionTypeSchema>;
export type SubmissionType = z.infer<typeof submissionTypeSchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type PublicRecordStatus = z.infer<typeof publicRecordStatusSchema>;
export type SteveEnergy = z.infer<typeof steveEnergySchema>;
export type ArchetypeTag = z.infer<typeof archetypeTagSchema>;
export type EraTag = z.infer<typeof eraTagSchema>;
export type ToneTag = z.infer<typeof toneTagSchema>;
export type TaxonomyData = z.infer<typeof taxonomyDataSchema>;
