import { z } from "zod";

import { idSchema, isoDateTimeSchema } from "@/src/lib/schema/common";

export const STUDY_WINDOW_START = 1960;
export const STUDY_WINDOW_END = 2025;

export const birthObservationStates = ["reported", "suppressed_or_absent"] as const;
export const studySexes = ["F", "M"] as const;
export const studyPanels = ["film", "tv"] as const;
export const studyVariantLabels = [
  "steve",
  "stephen",
  "steven",
  "stevie",
  "john",
  "david",
  "michael",
  "robert",
  "other"
] as const;

/** Screen and birth metrics can name the combined Steve-family group. Credits stay on one spelling. */
export const metricVariantLabels = [...studyVariantLabels, "steve_family"] as const;

export const screenMetricKinds = [
  "new_introductions_per_1000",
  "named_credit_share_per_1000",
  "work_share_per_100"
] as const;

export const birthShareStates = ["reported", "suppressed_or_absent", "partial_suppression"] as const;

export const studyProtocolSchema = z
  .object({
    id: idSchema,
    version: z.string().min(1).max(40),
    approvedStatus: z.enum(["draft", "approved"]),
    window: z
      .object({
        startYear: z.literal(STUDY_WINDOW_START),
        endYear: z.literal(STUDY_WINDOW_END)
      })
      .strict(),
    filmsPerDecade: z.number().int().positive().max(100_000),
    seriesPerDecade: z.number().int().positive().max(100_000),
    seed: z.string().min(8).max(80),
    samplingMethod: z.literal("feasibility_stratified_decade_genre"),
    panels: z.tuple([z.literal("film"), z.literal("tv")]),
    eligibilityPolicy: z.string().min(8).max(400),
    freeze: z.string().min(8).max(400),
    trackedBirthNames: z.tuple([z.literal("Steve"), z.literal("Steven"), z.literal("Stephen"), z.literal("Stevie")]),
    controlNames: z.tuple([z.literal("John"), z.literal("David"), z.literal("Michael"), z.literal("Robert")]),
    suppression: z.string().min(8).max(400),
    primaryOutcomeCalculated: z.literal(false)
  })
  .strict();

export const studyPopulationSchema = z
  .object({
    id: idSchema,
    specification: studyProtocolSchema,
    medium: z.literal("film_and_tv"),
    coverageStart: z.literal(STUDY_WINDOW_START),
    coverageEnd: z.literal(STUDY_WINDOW_END),
    eligibilityPolicy: z.string().min(8).max(400),
    samplingMethod: z.literal("feasibility_stratified_decade_genre"),
    sourceSnapshotId: idSchema.optional(),
    version: z.string().min(1).max(40),
    approvedStatus: z.enum(["draft", "approved"]),
    createdAt: isoDateTimeSchema
  })
  .strict();

export const studyMetadataCoverageSchema = z
  .object({
    hasYear: z.boolean(),
    hasGenre: z.boolean(),
    hasPopularity: z.boolean()
  })
  .strict();

export const studyTitleSelectionSchema = z
  .object({
    id: idSchema,
    studyId: idSchema,
    workKey: idSchema,
    provider: z.literal("imdb"),
    providerId: z.string().min(2).max(32),
    included: z.boolean(),
    reason: z.string().min(2).max(80),
    samplingStratum: z.string().min(3).max(80),
    decade: z.number().int().gte(STUDY_WINDOW_START).lte(STUDY_WINDOW_END),
    medium: z.enum(studyPanels),
    inclusionProbability: z.number().gte(0).lte(1),
    weight: z.number().positive().optional(),
    metadataCoverage: studyMetadataCoverageSchema,
    createdAt: isoDateTimeSchema
  })
  .strict();

export const studyCharacterCreditSchema = z
  .object({
    id: idSchema,
    studyId: idSchema,
    provider: z.literal("imdb"),
    workProviderId: z.string().min(2).max(32),
    decade: z.number().int().gte(STUDY_WINDOW_START).lte(STUDY_WINDOW_END),
    medium: z.enum(studyPanels),
    creditedName: z.string().min(1).max(200),
    normalizedName: z.string().min(1).max(200),
    givenNameToken: z.string().min(1).max(40).optional(),
    variantLabel: z.enum(studyVariantLabels),
    eligible: z.boolean(),
    exclusionReason: z.string().min(2).max(80).optional(),
    performerId: z.string().min(2).max(64),
    performerName: z.string().min(1).max(160).optional(),
    identityKey: idSchema,
    episodeIds: z.array(z.string().min(2).max(32)).default([]),
    sourceSnapshotId: idSchema.optional(),
    publicCandidate: z.literal(false),
    createdAt: isoDateTimeSchema
  })
  .strict()
  .superRefine((credit, context) => {
    if (credit.eligible === Boolean(credit.exclusionReason)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An eligible study credit has no exclusion reason. An ineligible credit has one.",
        path: ["eligible"]
      });
    }
  });

export const studyIntroductionSchema = z
  .object({
    id: idSchema,
    studyId: idSchema,
    identityKey: idSchema,
    creditId: idSchema,
    firstAppearanceYear: z.number().int().gte(STUDY_WINDOW_START).lte(STUDY_WINDOW_END),
    medium: z.enum(studyPanels),
    eligible: z.literal(true),
    provenance: z.enum(["film_release_year_proxy", "earliest_verified_episode_year"]),
    createdAt: isoDateTimeSchema
  })
  .strict();

export const birthNameCountSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(80),
    sex: z.enum(studySexes),
    birthYear: z.number().int().gte(1880).lte(2100),
    count: z.number().int().gte(5).nullable(),
    observationState: z.enum(birthObservationStates),
    sourceSnapshotId: idSchema
  })
  .strict()
  .superRefine((row, context) => {
    const reported = row.observationState === "reported";

    if (reported !== (row.count !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A reported SSA row has a count of at least 5. A suppressed or absent row has a null count.",
        path: ["count"]
      });
    }
  });

export const studyMetricSchema = z
  .object({
    id: idSchema,
    studyId: idSchema,
    metricKind: z.enum(screenMetricKinds).optional(),
    decade: z.number().int().gte(STUDY_WINDOW_START).lte(STUDY_WINDOW_END),
    medium: z.enum(studyPanels),
    variantLabel: z.enum(metricVariantLabels),
    numerator: z.number().int().nonnegative().nullable(),
    denominator: z.number().int().positive().nullable(),
    rate: z.number().nonnegative().nullable(),
    uncertaintyLow: z.number().nonnegative().nullable(),
    uncertaintyHigh: z.number().nonnegative().nullable(),
    denominatorLabel: z.string().min(2).max(80).optional(),
    clusterUnit: z.enum(["work", "series"]).optional(),
    clusterCount: z.number().int().nonnegative().optional(),
    bootstrapReplicates: z.number().int().positive().optional(),
    seed: z.string().min(8).max(80).optional(),
    completenessFlags: z.array(z.string().min(1).max(80)).default([]),
    calculationVersion: z.string().min(1).max(80),
    createdAt: isoDateTimeSchema
  })
  .strict()
  .superRefine((metric, context) => {
    const parts = [metric.numerator, metric.denominator, metric.rate];
    const present = parts.filter((part) => part !== null).length;

    if (present !== 0 && present !== 3) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A study metric rate requires both a numerator and a denominator.",
        path: ["rate"]
      });
    }
  });

export const studyExclusionSchema = z
  .object({
    id: idSchema,
    studyId: idSchema,
    recordId: z.string().min(2).max(120),
    reason: z.string().min(2).max(80),
    rule: z.string().min(2).max(80),
    decade: z.number().int().gte(STUDY_WINDOW_START).lte(STUDY_WINDOW_END).optional(),
    medium: z.enum(studyPanels).optional(),
    createdAt: isoDateTimeSchema
  })
  .strict();

export const studyCatalogTitleSchema = z
  .object({
    provider: z.literal("imdb"),
    providerId: z.string().min(2).max(32),
    title: z.string().min(1).max(200),
    titleType: z.string().min(2).max(40),
    year: z.number().int().gte(1888).lte(2100).optional(),
    genres: z.array(z.string().min(1).max(40)).default([]),
    votes: z.number().int().nonnegative().optional()
  })
  .strict();

export const studyCatalogSchema = z
  .object({
    titles: z.array(studyCatalogTitleSchema),
    principals: z.array(
      z
        .object({
          tconst: z.string().min(2).max(32),
          nconst: z.string().min(2).max(32),
          category: z.string().min(1).max(40),
          job: z.string().max(200),
          characters: z.string().max(2000)
        })
        .strict()
    ),
    episodes: z
      .array(
        z
          .object({
            tconst: z.string().min(2).max(32),
            parentTconst: z.string().min(2).max(32),
            seasonNumber: z.string().min(1).max(12).optional(),
            episodeNumber: z.string().min(1).max(12).optional()
          })
          .strict()
      )
      .default([]),
    names: z
      .array(
        z
          .object({
            nconst: z.string().min(2).max(32),
            primaryName: z.string().min(1).max(160)
          })
          .strict()
      )
      .default([])
  })
  .strict();

export const feasibilityCoverageRowSchema = z
  .object({
    decade: z.number().int(),
    medium: z.enum(studyPanels),
    worksRequested: z.number().int().nonnegative(),
    worksAvailable: z.number().int().nonnegative(),
    worksSelected: z.number().int().nonnegative(),
    quotaShortfall: z.number().int().nonnegative(),
    worksWithParsableNamedCredits: z.number().int().nonnegative(),
    shareOfSelectedWorksWithParsableNamedCredits: z.number().gte(0).lte(1).nullable(),
    namedCredits: z.number().int().nonnegative(),
    steveFamilyCredits: z.number().int().nonnegative(),
    controlNameCredits: z.number().int().nonnegative(),
    otherNamedCredits: z.number().int().nonnegative(),
    introductionsWithDebut: z.number().int().nonnegative(),
    excludedMissingDebut: z.number().int().nonnegative(),
    excludedSelf: z.number().int().nonnegative(),
    excludedUnnamed: z.number().int().nonnegative(),
    excludedNonPerformer: z.number().int().nonnegative(),
    groupedEpisodeCredits: z.number().int().nonnegative()
  })
  .strict();

export const feasibilityReportSchema = z
  .object({
    studyId: idSchema,
    kind: z.literal("feasibility_completeness"),
    primaryOutcomeCalculated: z.literal(false),
    window: z
      .object({
        startYear: z.literal(STUDY_WINDOW_START),
        endYear: z.literal(STUDY_WINDOW_END)
      })
      .strict(),
    rows: z.array(feasibilityCoverageRowSchema),
    possibleNamesakes: z.array(
      z
        .object({
          workProviderId: z.string().min(2).max(32),
          normalizedName: z.string().min(1).max(200),
          performerIds: z.array(z.string().min(2).max(64)).min(2)
        })
        .strict()
    ),
    titleExclusions: z.record(z.string(), z.number().int().nonnegative()),
    note: z.string().min(20).max(500)
  })
  .strict();

export type StudyProtocol = z.infer<typeof studyProtocolSchema>;
export type StudyPopulation = z.infer<typeof studyPopulationSchema>;
export type StudyTitleSelection = z.infer<typeof studyTitleSelectionSchema>;
export type StudyCharacterCredit = z.infer<typeof studyCharacterCreditSchema>;
export type StudyIntroduction = z.infer<typeof studyIntroductionSchema>;
export type BirthNameCount = z.infer<typeof birthNameCountSchema>;
export type StudyMetric = z.infer<typeof studyMetricSchema>;
export type StudyExclusion = z.infer<typeof studyExclusionSchema>;
export type StudyCatalogTitle = z.infer<typeof studyCatalogTitleSchema>;
export type StudyCatalog = z.infer<typeof studyCatalogSchema>;
export type FeasibilityCoverageRow = z.infer<typeof feasibilityCoverageRowSchema>;
export type FeasibilityReport = z.infer<typeof feasibilityReportSchema>;
export const birthNameShareSchema = z
  .object({
    id: idSchema,
    sourceSnapshotId: idSchema,
    birthYear: z.number().int().gte(1880).lte(STUDY_WINDOW_END),
    sex: z.enum(["F", "M", "combined"]),
    variantLabel: z.enum(metricVariantLabels),
    numerator: z.number().int().nonnegative().nullable(),
    denominator: z.number().int().positive().nullable(),
    rate: z.number().nonnegative().nullable(),
    denominatorLabel: z.enum(["ssa_reported_same_sex_births", "ssa_reported_births"]),
    observationState: z.enum(birthShareStates),
    calculationVersion: z.string().min(1).max(80),
    createdAt: isoDateTimeSchema
  })
  .strict()
  .superRefine((share, context) => {
    if (share.observationState === "reported") {
      if (share.numerator === null || share.denominator === null || share.rate === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A reported birth share needs a numerator, a denominator, and a rate.",
          path: ["rate"]
        });
      }
      return;
    }

    if (share.numerator !== null || share.rate !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A suppressed or partial birth share has a null numerator and a null rate.",
        path: ["numerator"]
      });
    }
  });

export const studyLagScanSchema = z
  .object({
    id: idSchema,
    studyId: idSchema,
    lagYears: z.number().int().gte(0).lte(50),
    medium: z.enum(studyPanels),
    pairedDecades: z.number().int().nonnegative(),
    correlation: z.number().gte(-1).lte(1).nullable(),
    status: z.enum(["reported", "insufficient_bins", "undefined_correlation"]),
    selectedLag: z.null(),
    calculationVersion: z.string().min(1).max(80),
    createdAt: isoDateTimeSchema
  })
  .strict();

export const analysisProtocolSchema = z
  .object({
    id: idSchema,
    calculationVersion: z.string().min(1).max(80),
    seed: z.string().min(8).max(80),
    bootstrapReplicates: z.number().int().gte(20).lte(10_000),
    confidenceLevel: z.literal(0.95),
    primaryOutcome: z.literal("new_introductions_per_1000"),
    primaryVariant: z.literal("steve_family"),
    panels: z.tuple([z.literal("film"), z.literal("tv")]),
    window: z
      .object({
        startYear: z.literal(STUDY_WINDOW_START),
        endYear: z.literal(STUDY_WINDOW_END)
      })
      .strict(),
    lagYears: z.tuple([
      z.literal(0),
      z.literal(5),
      z.literal(10),
      z.literal(15),
      z.literal(20),
      z.literal(25),
      z.literal(30),
      z.literal(35),
      z.literal(40),
      z.literal(45),
      z.literal(50)
    ]),
    controls: z.tuple([z.literal("john"), z.literal("david"), z.literal("michael"), z.literal("robert")]),
    steveFamily: z.tuple([z.literal("steve"), z.literal("stephen"), z.literal("steven"), z.literal("stevie")]),
    commercialPrevalenceCalculated: z.literal(false),
    publicIndexIncluded: z.literal(false),
    controlsArePublicEntries: z.literal(false)
  })
  .strict();

export type StudyVariantLabel = (typeof studyVariantLabels)[number];
export type MetricVariantLabel = (typeof metricVariantLabels)[number];
export type ScreenMetricKind = (typeof screenMetricKinds)[number];
export type StudyPanel = (typeof studyPanels)[number];
export type StudySex = (typeof studySexes)[number];
export type BirthNameShare = z.infer<typeof birthNameShareSchema>;
export type StudyLagScan = z.infer<typeof studyLagScanSchema>;
export type AnalysisProtocol = z.infer<typeof analysisProtocolSchema>;
