import { createHash } from "node:crypto";

import { roundMetric } from "@/src/lib/data/bootstrap";
import { studyWindowYears } from "@/src/lib/data/ssa";
import {
  STUDY_WINDOW_END,
  birthNameShareSchema,
  type AnalysisProtocol,
  type BirthNameCount,
  type BirthNameShare,
  type MetricVariantLabel,
  type StudySex
} from "@/src/lib/schema";

const STEVE_NAMES = ["Steve", "Steven", "Stephen", "Stevie"] as const;
const CONTROL_NAMES = ["John", "David", "Michael", "Robert"] as const;
const TRACKED_NAMES = [...STEVE_NAMES, ...CONTROL_NAMES] as const;

const VARIANT_BY_NAME: Record<(typeof TRACKED_NAMES)[number], MetricVariantLabel> = {
  Steve: "steve",
  Steven: "steven",
  Stephen: "stephen",
  Stevie: "stevie",
  John: "john",
  David: "david",
  Michael: "michael",
  Robert: "robert"
};

type Cell = {
  state: "reported" | "suppressed_or_absent" | "partial";
  count: number | null;
};

/**
 * Sex-specific and combined birth shares for the tracked names.
 * A suppressed cell stays null. A combined Steve-family share stays null when any spelling is suppressed,
 * so a missing spelling is not treated as zero.
 */
export function buildBirthShares(input: {
  observations: readonly BirthNameCount[];
  sourceSnapshotId: string;
  protocol: Pick<AnalysisProtocol, "calculationVersion">;
  now: string;
}): BirthNameShare[] {
  const shares: BirthNameShare[] = [];

  for (const birthYear of shareYears(input.observations)) {
    for (const sex of ["F", "M"] as const) {
      const cells = new Map<MetricVariantLabel, Cell>();

      for (const name of TRACKED_NAMES) {
        const cell = observedCell(input.observations, birthYear, sex, name);
        cells.set(VARIANT_BY_NAME[name], cell);
        shares.push(
          shareRow({
            ...input,
            birthYear,
            sex,
            variantLabel: VARIANT_BY_NAME[name],
            cell,
            denominator: reportedTotal(input.observations, birthYear, sex),
            denominatorLabel: "ssa_reported_same_sex_births"
          })
        );
      }

      shares.push(
        shareRow({
          ...input,
          birthYear,
          sex,
          variantLabel: "steve_family",
          cell: combineCells(STEVE_NAMES.map((name) => cells.get(VARIANT_BY_NAME[name]) ?? { state: "suppressed_or_absent", count: null })),
          denominator: reportedTotal(input.observations, birthYear, sex),
          denominatorLabel: "ssa_reported_same_sex_births"
        })
      );
    }

    for (const name of TRACKED_NAMES) {
      shares.push(combinedSexRow(input, birthYear, VARIANT_BY_NAME[name], [name]));
    }

    shares.push(combinedSexRow(input, birthYear, "steve_family", STEVE_NAMES));
  }

  return shares.sort(compareShares);
}

function shareYears(observations: readonly BirthNameCount[]): number[] {
  const years = new Set<number>(studyWindowYears());

  for (const row of observations) {
    if (row.birthYear >= 1880 && row.birthYear <= STUDY_WINDOW_END) {
      years.add(row.birthYear);
    }
  }

  return [...years].sort((left, right) => left - right);
}

function observedCell(observations: readonly BirthNameCount[], birthYear: number, sex: StudySex, name: string): Cell {
  const row = observations.find(
    (candidate) => candidate.birthYear === birthYear && candidate.sex === sex && candidate.name.toLowerCase() === name.toLowerCase()
  );

  if (!row || row.observationState !== "reported" || row.count === null) {
    return { state: "suppressed_or_absent", count: null };
  }

  return { state: "reported", count: row.count };
}

function reportedTotal(observations: readonly BirthNameCount[], birthYear: number, sex?: StudySex): number {
  return observations.reduce((sum, row) => {
    if (row.birthYear !== birthYear || row.observationState !== "reported" || row.count === null) {
      return sum;
    }

    if (sex && row.sex !== sex) {
      return sum;
    }

    return sum + row.count;
  }, 0);
}

function combineCells(cells: readonly Cell[]): Cell {
  if (cells.every((cell) => cell.state === "suppressed_or_absent")) {
    return { state: "suppressed_or_absent", count: null };
  }

  if (cells.some((cell) => cell.state !== "reported" || cell.count === null)) {
    return { state: "partial", count: null };
  }

  return {
    state: "reported",
    count: cells.reduce((sum, cell) => sum + (cell.count ?? 0), 0)
  };
}

function combinedSexRow(
  input: {
    observations: readonly BirthNameCount[];
    sourceSnapshotId: string;
    protocol: Pick<AnalysisProtocol, "calculationVersion">;
    now: string;
  },
  birthYear: number,
  variantLabel: MetricVariantLabel,
  names: readonly string[]
): BirthNameShare {
  const female = combineCells(names.map((name) => observedCell(input.observations, birthYear, "F", name)));
  const male = combineCells(names.map((name) => observedCell(input.observations, birthYear, "M", name)));
  let cell: Cell;

  if (female.state === "reported" && male.state === "reported") {
    cell = { state: "reported", count: (female.count ?? 0) + (male.count ?? 0) };
  } else if (female.state === "suppressed_or_absent" && male.state === "suppressed_or_absent") {
    cell = { state: "suppressed_or_absent", count: null };
  } else {
    cell = { state: "suppressed_or_absent", count: null };
    return shareRow({
      ...input,
      birthYear,
      sex: "combined",
      variantLabel,
      cell,
      denominator: reportedTotal(input.observations, birthYear),
      denominatorLabel: "ssa_reported_births",
      partial: true
    });
  }

  return shareRow({
    ...input,
    birthYear,
    sex: "combined",
    variantLabel,
    cell,
    denominator: reportedTotal(input.observations, birthYear),
    denominatorLabel: "ssa_reported_births"
  });
}

function shareRow(input: {
  sourceSnapshotId: string;
  protocol: Pick<AnalysisProtocol, "calculationVersion">;
  now: string;
  birthYear: number;
  sex: "F" | "M" | "combined";
  variantLabel: MetricVariantLabel;
  cell: Cell;
  denominator: number;
  denominatorLabel: "ssa_reported_same_sex_births" | "ssa_reported_births";
  partial?: boolean;
}): BirthNameShare {
  const partial = input.partial === true || input.cell.state === "partial";
  const baseMissing = input.denominator <= 0;
  const reported = input.cell.state === "reported" && input.cell.count !== null && !baseMissing && !partial;
  const observationState = partial ? "partial_suppression" : reported ? "reported" : "suppressed_or_absent";

  return birthNameShareSchema.parse({
    id: `share-${digest([
      input.sourceSnapshotId,
      input.protocol.calculationVersion,
      String(input.birthYear),
      input.sex,
      input.variantLabel
    ])}`,
    sourceSnapshotId: input.sourceSnapshotId,
    birthYear: input.birthYear,
    sex: input.sex,
    variantLabel: input.variantLabel,
    numerator: reported ? input.cell.count : null,
    denominator: input.denominator > 0 ? input.denominator : null,
    rate: reported ? roundMetric((100_000 * (input.cell.count ?? 0)) / input.denominator) : null,
    denominatorLabel: input.denominatorLabel,
    observationState,
    calculationVersion: input.protocol.calculationVersion,
    createdAt: input.now
  });
}

function compareShares(left: BirthNameShare, right: BirthNameShare): number {
  const sexOrder = { F: 0, M: 1, combined: 2 };
  return (
    left.birthYear - right.birthYear ||
    sexOrder[left.sex] - sexOrder[right.sex] ||
    left.variantLabel.localeCompare(right.variantLabel)
  );
}

function digest(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
}
