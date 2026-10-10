import { extractStudyCredits } from "@/src/lib/data/study-credits";
import { selectFeasibilitySample, studyDecades } from "@/src/lib/data/study-sample";
import {
  feasibilityReportSchema,
  type FeasibilityCoverageRow,
  type FeasibilityReport,
  type StudyCatalog,
  type StudyCharacterCredit,
  type StudyExclusion,
  type StudyIntroduction,
  type StudyProtocol,
  type StudyTitleSelection
} from "@/src/lib/schema";

const STEVE_FAMILY = new Set(["steve", "stephen", "steven", "stevie"]);
const CONTROL_NAMES = new Set(["john", "david", "michael", "robert"]);

const COMPLETENESS_NOTE =
  "Feasibility completeness and name-matching audit. This is not a rate of new Steve introductions, and it is not a public finding.";

export function runFeasibilityPilot(input: { catalog: StudyCatalog; protocol?: StudyProtocol; now: string }) {
  const selected = selectFeasibilitySample({
    titles: input.catalog.titles,
    protocol: input.protocol,
    now: input.now
  });
  const extracted = extractStudyCredits({
    studyId: selected.population.id,
    selections: selected.selections,
    titles: input.catalog.titles,
    principals: input.catalog.principals,
    episodes: input.catalog.episodes,
    names: input.catalog.names,
    now: input.now
  });
  const exclusions = [...selected.exclusions, ...extracted.exclusions].sort((left, right) => left.id.localeCompare(right.id));
  const report = buildFeasibilityReport({
    protocol: selected.population.specification,
    selections: selected.selections,
    credits: extracted.credits,
    introductions: extracted.introductions,
    creditExclusions: extracted.exclusions,
    titleExclusions: selected.exclusions
  });

  return {
    population: selected.population,
    selections: selected.selections,
    credits: extracted.credits,
    introductions: extracted.introductions,
    exclusions,
    report,
    csv: feasibilityCompletenessCsv(report)
  };
}

export function buildFeasibilityReport(input: {
  protocol: StudyProtocol;
  selections: readonly StudyTitleSelection[];
  credits: readonly StudyCharacterCredit[];
  introductions: readonly StudyIntroduction[];
  creditExclusions: readonly StudyExclusion[];
  titleExclusions: readonly StudyExclusion[];
}): FeasibilityReport {
  const introductionCredits = new Set(input.introductions.map((introduction) => introduction.creditId));
  const rows = studyDecades().flatMap((decade) =>
    (["film", "tv"] as const).map((medium) =>
      coverageRow({
        decade,
        medium,
        requested: medium === "film" ? input.protocol.filmsPerDecade : input.protocol.seriesPerDecade,
        selections: input.selections.filter((selection) => selection.decade === decade && selection.medium === medium),
        credits: input.credits.filter((credit) => credit.decade === decade && credit.medium === medium),
        introductionCredits,
        exclusions: input.creditExclusions.filter((exclusion) => exclusion.decade === decade && exclusion.medium === medium)
      })
    )
  );
  const titleExclusions: Record<string, number> = {};

  for (const exclusion of input.titleExclusions) {
    titleExclusions[exclusion.reason] = (titleExclusions[exclusion.reason] ?? 0) + 1;
  }

  return feasibilityReportSchema.parse({
    studyId: input.protocol.id,
    kind: "feasibility_completeness",
    primaryOutcomeCalculated: false,
    window: input.protocol.window,
    rows,
    possibleNamesakes: findNamesakes(input.credits),
    titleExclusions,
    note: COMPLETENESS_NOTE
  });
}

export function feasibilityCompletenessCsv(report: FeasibilityReport): string {
  const header = [
    "decade",
    "medium",
    "works_requested",
    "works_available",
    "works_selected",
    "quota_shortfall",
    "works_with_parsable_named_credits",
    "share_of_selected_works_with_parsable_named_credits",
    "named_credits",
    "steve_family_credits",
    "control_name_credits",
    "other_named_credits",
    "introductions_with_debut",
    "excluded_missing_debut",
    "excluded_self",
    "excluded_unnamed",
    "excluded_non_performer",
    "grouped_episode_credits"
  ];
  const lines = report.rows.map((row) =>
    [
      row.decade,
      row.medium,
      row.worksRequested,
      row.worksAvailable,
      row.worksSelected,
      row.quotaShortfall,
      row.worksWithParsableNamedCredits,
      row.shareOfSelectedWorksWithParsableNamedCredits === null
        ? ""
        : row.shareOfSelectedWorksWithParsableNamedCredits.toFixed(4),
      row.namedCredits,
      row.steveFamilyCredits,
      row.controlNameCredits,
      row.otherNamedCredits,
      row.introductionsWithDebut,
      row.excludedMissingDebut,
      row.excludedSelf,
      row.excludedUnnamed,
      row.excludedNonPerformer,
      row.groupedEpisodeCredits
    ].join(",")
  );

  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

function coverageRow(input: {
  decade: number;
  medium: "film" | "tv";
  requested: number;
  selections: readonly StudyTitleSelection[];
  credits: readonly StudyCharacterCredit[];
  introductionCredits: ReadonlySet<string>;
  exclusions: readonly StudyExclusion[];
}): FeasibilityCoverageRow {
  const selectedIds = new Set(input.selections.filter((selection) => selection.included).map((selection) => selection.providerId));
  const eligible = input.credits.filter((credit) => credit.eligible);
  const worksWithCredits = new Set(eligible.map((credit) => credit.workProviderId));
  const selectedCount = selectedIds.size;
  let withParsable = 0;

  for (const workId of selectedIds) {
    if (worksWithCredits.has(workId)) {
      withParsable += 1;
    }
  }

  return {
    decade: input.decade,
    medium: input.medium,
    worksRequested: input.requested,
    worksAvailable: input.selections.length,
    worksSelected: selectedCount,
    quotaShortfall: Math.max(0, input.requested - input.selections.length),
    worksWithParsableNamedCredits: withParsable,
    shareOfSelectedWorksWithParsableNamedCredits: selectedCount === 0 ? null : round4(withParsable / selectedCount),
    namedCredits: eligible.length,
    steveFamilyCredits: eligible.filter((credit) => STEVE_FAMILY.has(credit.variantLabel)).length,
    controlNameCredits: eligible.filter((credit) => CONTROL_NAMES.has(credit.variantLabel)).length,
    otherNamedCredits: eligible.filter((credit) => credit.variantLabel === "other").length,
    introductionsWithDebut: eligible.filter((credit) => input.introductionCredits.has(credit.id)).length,
    excludedMissingDebut: countReason(input.exclusions, "missing_debut_year"),
    excludedSelf: countReason(input.exclusions, "self_credit"),
    excludedUnnamed: countReason(input.exclusions, "unnamed_or_missing_role"),
    excludedNonPerformer: countReason(input.exclusions, "not_a_performer"),
    groupedEpisodeCredits: countReason(input.exclusions, "grouped_episode_credit")
  };
}

function findNamesakes(credits: readonly StudyCharacterCredit[]) {
  const grouped = new Map<string, { workProviderId: string; normalizedName: string; performerIds: Set<string> }>();

  for (const credit of credits) {
    if (!credit.eligible) {
      continue;
    }

    const key = `${credit.workProviderId}\0${credit.normalizedName}`;
    const bucket = grouped.get(key) ?? {
      workProviderId: credit.workProviderId,
      normalizedName: credit.normalizedName,
      performerIds: new Set<string>()
    };
    bucket.performerIds.add(credit.performerId);
    grouped.set(key, bucket);
  }

  return [...grouped.values()]
    .filter((bucket) => bucket.performerIds.size > 1)
    .map((bucket) => ({
      workProviderId: bucket.workProviderId,
      normalizedName: bucket.normalizedName,
      performerIds: [...bucket.performerIds].sort()
    }))
    .sort((left, right) => left.workProviderId.localeCompare(right.workProviderId) || left.normalizedName.localeCompare(right.normalizedName));
}

function countReason(exclusions: readonly StudyExclusion[], reason: string): number {
  return exclusions.filter((exclusion) => exclusion.reason === reason).length;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
