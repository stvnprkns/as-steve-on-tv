import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  archetypeTags,
  collectionTypes,
  confidenceLevels,
  contentStatuses,
  entryTypes,
  eraTags,
  mediums,
  moderationStatuses,
  nameVariants,
  publicRecordStatuses,
  steveEnergyLevels,
  submissionTypes,
  taxonomyDataSchema,
  toneTags,
  type TaxonomyData
} from "@/src/lib/schema";
import { getContentPath } from "@/src/lib/utils/fs";

const taxonomyPath = getContentPath("taxonomies", "index.json");

function assertExactMatch(label: string, actual: readonly string[], expected: readonly string[]) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(
      `${taxonomyPath} is out of sync for ${label}. Update the JSON file to match the schema vocabulary.`
    );
  }
}

export async function loadTaxonomy(): Promise<TaxonomyData> {
  const raw = await readFile(path.resolve(taxonomyPath), "utf8");
  const parsed = taxonomyDataSchema.parse(JSON.parse(raw));

  assertExactMatch("nameVariants", parsed.nameVariants, nameVariants);
  assertExactMatch("mediums", parsed.mediums, mediums);
  assertExactMatch("entryTypes", parsed.entryTypes, entryTypes);
  assertExactMatch("contentStatuses", parsed.contentStatuses, contentStatuses);
  assertExactMatch("moderationStatuses", parsed.moderationStatuses, moderationStatuses);
  assertExactMatch("collectionTypes", parsed.collectionTypes, collectionTypes);
  assertExactMatch("submissionTypes", parsed.submissionTypes, submissionTypes);
  assertExactMatch("confidenceLevels", parsed.confidenceLevels, confidenceLevels);
  assertExactMatch("publicRecordStatuses", parsed.publicRecordStatuses, publicRecordStatuses);
  assertExactMatch("steveEnergyLevels", parsed.steveEnergyLevels, steveEnergyLevels);
  assertExactMatch("archetypeTags", parsed.archetypeTags, archetypeTags);
  assertExactMatch("eraTags", parsed.eraTags, eraTags);
  assertExactMatch("toneTags", parsed.toneTags, toneTags);

  return parsed;
}
