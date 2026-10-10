import { createHash } from "node:crypto";

/** Stable unit interval stream. The same seed string rebuilds the same draws. */
export function unitStream(parts: readonly string[]): () => number {
  let state = createHash("sha256").update(parts.join("\0")).digest().readUInt32BE(0);

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function resampleIndexes(length: number, random: () => number): number[] {
  const indexes: number[] = [];

  for (let index = 0; index < length; index += 1) {
    indexes.push(Math.floor(random() * length));
  }

  return indexes;
}

export function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const low = sorted[lower] ?? 0;
  const high = sorted[upper] ?? low;

  if (lower === upper) {
    return low;
  }

  const weight = index - lower;
  return low * (1 - weight) + high * weight;
}

export function roundMetric(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Pearson correlation. Returns null when fewer than 3 pairs are supplied or a series has no variance. */
export function pearson(left: readonly number[], right: readonly number[]): number | null {
  if (left.length !== right.length || left.length < 3) {
    return null;
  }

  const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftSquare = 0;
  let rightSquare = 0;

  for (let index = 0; index < left.length; index += 1) {
    const x = (left[index] ?? 0) - leftMean;
    const y = (right[index] ?? 0) - rightMean;
    numerator += x * y;
    leftSquare += x * x;
    rightSquare += y * y;
  }

  if (leftSquare === 0 || rightSquare === 0) {
    return null;
  }

  return roundMetric(numerator / Math.sqrt(leftSquare * rightSquare));
}
