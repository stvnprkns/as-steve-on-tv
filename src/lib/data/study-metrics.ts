import { createHash } from "node:crypto";

import { percentile, resampleIndexes, roundMetric, unitStream } from "@/src/lib/data/bootstrap";
import { decadeOf, studyDecades } from "@/src/lib/data/study-sample";
import {
  metricVariantLabels,
  screenMetricKinds,
  studyMetricSchema,
  type AnalysisProtocol,
  type MetricVariantLabel,
  type ScreenMetricKind,
  type StudyCharacterCredit,
  type StudyIntroduction,
  type StudyMetric,
  type StudyPanel,
  type StudyVariantLabel
} from "@/src/lib/schema";

const STEVE_FAMILY = new Set<StudyVariantLabel>(["steve", "stephen", "steven", "stevie"]);

type Counts = Record<MetricVariantLabel, number>;

type Cluster = {
  workProviderId: string;
  counts: Counts;
  weight: number;
};

const SCALE: Record<ScreenMetricKind, number> = {
  new_introductions_per_1000: 1000,
  named_credit_share_per_1000: 1000,
  work_share_per_100: 100
};

const DENOMINATOR_LABEL: Record<ScreenMetricKind, string> = {
  new_introductions_per_1000: "eligible_new_named_character_identities",
  named_credit_share_per_1000: "eligible_named_credits",
  work_share_per_100: "eligible_selected_works_with_named_credits"
};

/**
 * Film and television stay separate. Bootstrap resamples works or series, not individual credits.
 * An empty bin stays null. A bin with a denominator and no matching names is a real zero.
 */
export function buildScreenMetrics(input: {
  studyId: string;
  credits: readonly StudyCharacterCredit[];
  introductions: readonly StudyIntroduction[];
  protocol: AnalysisProtocol;
  now: string;
}): StudyMetric[] {
  assertUniqueIntroductions(input.introductions);
  const corpus = corpusDigest(input.studyId, input.credits, input.introductions, input.protocol);
  const metrics: StudyMetric[] = [];

  for (const metricKind of screenMetricKinds) {
    for (const decade of studyDecades()) {
      for (const medium of ["film", "tv"] as const) {
        metrics.push(
          ...metricRows({
            ...input,
            metricKind,
            decade,
            medium,
            corpus,
            clusters: clustersFor(metricKind, decade, medium, input.credits, input.introductions)
          })
        );
      }
    }
  }

  return metrics.sort(compareMetrics);
}

function clustersFor(
  metricKind: ScreenMetricKind,
  decade: number,
  medium: StudyPanel,
  credits: readonly StudyCharacterCredit[],
  introductions: readonly StudyIntroduction[]
): Cluster[] {
  if (metricKind === "new_introductions_per_1000") {
    return introductionClusters(decade, medium, credits, introductions);
  }

  if (metricKind === "named_credit_share_per_1000") {
    return creditClusters(decade, medium, credits);
  }

  return workClusters(decade, medium, credits);
}

function introductionClusters(
  decade: number,
  medium: StudyPanel,
  credits: readonly StudyCharacterCredit[],
  introductions: readonly StudyIntroduction[]
): Cluster[] {
  const creditById = new Map(credits.map((credit) => [credit.id, credit]));
  const byWork = new Map<string, Cluster>();

  for (const introduction of introductions) {
    if (introduction.medium !== medium || decadeOf(introduction.firstAppearanceYear) !== decade) {
      continue;
    }

    const credit = creditById.get(introduction.creditId);

    if (!credit?.eligible) {
      continue;
    }

    const cluster = byWork.get(credit.workProviderId) ?? emptyCluster(credit.workProviderId);
    addLabel(cluster.counts, credit.variantLabel);
    cluster.weight += 1;
    byWork.set(credit.workProviderId, cluster);
  }

  return sortClusters(byWork);
}

function creditClusters(decade: number, medium: StudyPanel, credits: readonly StudyCharacterCredit[]): Cluster[] {
  const byWork = new Map<string, Cluster>();

  for (const credit of credits) {
    if (!credit.eligible || credit.medium !== medium || credit.decade !== decade) {
      continue;
    }

    const cluster = byWork.get(credit.workProviderId) ?? emptyCluster(credit.workProviderId);
    addLabel(cluster.counts, credit.variantLabel);
    cluster.weight += 1;
    byWork.set(credit.workProviderId, cluster);
  }

  return sortClusters(byWork);
}

function workClusters(decade: number, medium: StudyPanel, credits: readonly StudyCharacterCredit[]): Cluster[] {
  const labelsByWork = new Map<string, StudyVariantLabel[]>();

  for (const credit of credits) {
    if (!credit.eligible || credit.medium !== medium || credit.decade !== decade) {
      continue;
    }

    const labels = labelsByWork.get(credit.workProviderId) ?? [];
    labels.push(credit.variantLabel);
    labelsByWork.set(credit.workProviderId, labels);
  }

  return [...labelsByWork.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([workProviderId, labels]) => {
      const counts = emptyCounts();

      for (const label of new Set(labels)) {
        counts[label] = 1;

        if (STEVE_FAMILY.has(label)) {
          counts.steve_family = 1;
        }
      }

      return { workProviderId, counts, weight: 1 };
    });
}

function metricRows(input: {
  studyId: string;
  protocol: AnalysisProtocol;
  now: string;
  metricKind: ScreenMetricKind;
  decade: number;
  medium: StudyPanel;
  corpus: string;
  clusters: readonly Cluster[];
}): StudyMetric[] {
  const scale = SCALE[input.metricKind];
  const denominator = input.clusters.reduce((sum, cluster) => sum + cluster.weight, 0);
  const random = unitStream([
    input.protocol.seed,
    input.protocol.calculationVersion,
    input.metricKind,
    String(input.decade),
    input.medium
  ]);
  const replicateRates = new Map<MetricVariantLabel, number[]>();
  let emptyReplicates = 0;

  for (const variant of metricVariantLabels) {
    replicateRates.set(variant, []);
  }

  if (denominator > 0 && input.clusters.length > 0) {
    for (let replicate = 0; replicate < input.protocol.bootstrapReplicates; replicate += 1) {
      const drawn: Cluster[] = [];

      for (const index of resampleIndexes(input.clusters.length, random)) {
        const cluster = input.clusters[index];

        if (cluster) {
          drawn.push(cluster);
        }
      }

      const drawnDenominator = drawn.reduce((sum, cluster) => sum + cluster.weight, 0);

      if (drawnDenominator === 0) {
        emptyReplicates += 1;
        continue;
      }

      for (const variant of metricVariantLabels) {
        const drawnNumerator = drawn.reduce((sum, cluster) => sum + cluster.counts[variant], 0);
        replicateRates.get(variant)?.push(roundMetric((scale * drawnNumerator) / drawnDenominator));
      }
    }
  }

  return metricVariantLabels.map((variant) => {
    const numerator = input.clusters.reduce((sum, cluster) => sum + cluster.counts[variant], 0);
    const flags: string[] = [];
    const replicates = replicateRates.get(variant) ?? [];
    let uncertaintyLow: number | null = null;
    let uncertaintyHigh: number | null = null;

    if (denominator === 0) {
      flags.push("empty_denominator");
    } else if (replicates.length < 2) {
      flags.push("bootstrap_undefined");
    } else {
      uncertaintyLow = roundMetric(percentile(replicates, 0.025));
      uncertaintyHigh = roundMetric(percentile(replicates, 0.975));
    }

    if (emptyReplicates > 0) {
      flags.push("bootstrap_empty_replicates");
    }

    return studyMetricSchema.parse({
      id: `metric-${digest([
        input.corpus,
        input.protocol.calculationVersion,
        input.metricKind,
        String(input.decade),
        input.medium,
        variant
      ])}`,
      studyId: input.studyId,
      metricKind: input.metricKind,
      decade: input.decade,
      medium: input.medium,
      variantLabel: variant,
      numerator: denominator === 0 ? null : numerator,
      denominator: denominator === 0 ? null : denominator,
      rate: denominator === 0 ? null : roundMetric((scale * numerator) / denominator),
      uncertaintyLow,
      uncertaintyHigh,
      denominatorLabel: DENOMINATOR_LABEL[input.metricKind],
      clusterUnit: input.medium === "tv" ? "series" : "work",
      clusterCount: input.clusters.length,
      bootstrapReplicates: input.protocol.bootstrapReplicates,
      seed: input.protocol.seed,
      completenessFlags: flags,
      calculationVersion: input.protocol.calculationVersion,
      createdAt: input.now
    });
  });
}

function assertUniqueIntroductions(introductions: readonly StudyIntroduction[]) {
  const seen = new Set<string>();

  for (const introduction of introductions) {
    if (seen.has(introduction.identityKey)) {
      throw new Error(`Duplicate study introduction for ${introduction.identityKey}.`);
    }

    seen.add(introduction.identityKey);
  }
}

function emptyCounts(): Counts {
  return {
    steve: 0,
    stephen: 0,
    steven: 0,
    stevie: 0,
    john: 0,
    david: 0,
    michael: 0,
    robert: 0,
    other: 0,
    steve_family: 0
  };
}

function emptyCluster(workProviderId: string): Cluster {
  return { workProviderId, counts: emptyCounts(), weight: 0 };
}

function addLabel(counts: Counts, label: StudyVariantLabel) {
  counts[label] += 1;

  if (STEVE_FAMILY.has(label)) {
    counts.steve_family += 1;
  }
}

function sortClusters(byWork: Map<string, Cluster>): Cluster[] {
  return [...byWork.values()].sort((left, right) => left.workProviderId.localeCompare(right.workProviderId));
}

function corpusDigest(
  studyId: string,
  credits: readonly StudyCharacterCredit[],
  introductions: readonly StudyIntroduction[],
  protocol: AnalysisProtocol
): string {
  const creditIds = credits.map((credit) => credit.id).sort();
  const introductionIds = introductions.map((introduction) => `${introduction.identityKey}:${introduction.firstAppearanceYear}`).sort();
  return digest([studyId, protocol.calculationVersion, protocol.seed, ...creditIds, ...introductionIds]);
}

function compareMetrics(left: StudyMetric, right: StudyMetric): number {
  return (
    (left.metricKind ?? "").localeCompare(right.metricKind ?? "") ||
    left.decade - right.decade ||
    left.medium.localeCompare(right.medium) ||
    left.variantLabel.localeCompare(right.variantLabel)
  );
}

function digest(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
}

export function metricScale(metricKind: ScreenMetricKind): number {
  return SCALE[metricKind];
}
