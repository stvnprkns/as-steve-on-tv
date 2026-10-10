import type { NameVariant } from "@/src/lib/schema";

/** Given names the index and the study treat as Steve-family spellings. */
export const STEVE_GIVEN_NAMES = ["steve", "stephen", "steven", "stevie"] as const;

const STEVE_GIVEN_NAME_SET = new Set<string>(STEVE_GIVEN_NAMES);

const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "miss", "sir", "prof", "professor"]);

export type SteveGivenNameMatch = {
  variant: NameVariant;
  token: string;
};

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}+/gu, "");
}

/**
 * Anchored name tokens. `Stevenson` and `Stevens` stay intact and do not match.
 * Possessives (`Steve's`) reduce to the given name. Honorifics are kept here so
 * character identity can still tell `Dr. Steven Strange` from another Steven.
 */
export function nameTokens(value: string): string[] {
  const prepared = stripAccents(value.replace(/\([^)]*\)/g, " "))
    .toLowerCase()
    .replace(/[’']/g, "'");

  return prepared
    .split(/[^a-z0-9']+/i)
    .map((token) => token.replace(/'s$/i, "").replace(/'/g, ""))
    .filter((token) => token.length > 0);
}

export function normalizeCharacterToken(value: string): string {
  return nameTokens(value).join(" ");
}

export function isSteveGivenNameToken(token: string): token is NameVariant {
  return STEVE_GIVEN_NAME_SET.has(token);
}

/** First token that is not an honorific. `Dr. John Smith` yields `john`. */
export function firstGivenNameToken(value: string): string | null {
  const givenName = nameTokens(value).find((token) => !HONORIFICS.has(token));
  return givenName ?? null;
}

/** A longer token that merely contains "steve", such as Stevenson or Stevens. */
export function isEmbeddedSteveFalsePositive(token: string): boolean {
  return token.includes("steve") && !isSteveGivenNameToken(token);
}

/** First anchored Steve-family token in a character credit, left to right. */
export function matchSteveGivenName(value: string): SteveGivenNameMatch | null {
  for (const token of nameTokens(value)) {
    if (isSteveGivenNameToken(token)) {
      return { variant: token, token };
    }
  }

  return null;
}

/**
 * The performer's own given name, not a later middle name.
 * `Steven Actor` matches. `Mary Steve Smith` does not.
 */
export function matchPerformerGivenName(primaryName: string): SteveGivenNameMatch | null {
  const tokens = nameTokens(primaryName).filter((token) => !HONORIFICS.has(token));
  const givenName = tokens[0];

  if (!givenName || !isSteveGivenNameToken(givenName)) {
    return null;
  }

  return { variant: givenName, token: givenName };
}
