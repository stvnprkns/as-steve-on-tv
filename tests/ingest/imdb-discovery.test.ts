import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  isEmbeddedSteveFalsePositive,
  matchPerformerGivenName,
  matchSteveGivenName
} from "../../src/lib/data/name-variants";
import {
  buildCandidateId,
  classifyImdbTitleType,
  discoverImdbCandidates,
  overlayDatabaseReviewState,
  parseCharacterCredits,
  parseEpisodeLine,
  parseNameBasicsLine,
  parsePrincipalLine,
  parseTitleBasicsLine,
  reconcileCandidatesWithReviewed,
  TV_MOVIE_MEDIUM_NOTE,
  type DiscoveryResult
} from "../../src/lib/data/normalize-character";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDir = path.join(repoRoot, "tests", "fixtures", "ingest");
const NOW = "2026-10-10T00:00:00Z";

function loadLines(fileName: string) {
  return readFileSync(path.join(fixtureDir, fileName), "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .slice(1);
}

function loadDiscovery(options?: { episodes?: boolean }) {
  const titles = loadLines("title.basics.tsv").map((line) => {
    const row = parseTitleBasicsLine(line);
    assert.ok(row, line);
    return row;
  });
  const names = loadLines("name.basics.tsv").map((line) => {
    const row = parseNameBasicsLine(line);
    assert.ok(row, line);
    return row;
  });
  const principals = loadLines("title.principals.tsv").map((line) => {
    const row = parsePrincipalLine(line);
    assert.ok(row, line);
    return row;
  });
  const episodes =
    options?.episodes === false
      ? []
      : loadLines("title.episode.tsv").map((line) => {
          const row = parseEpisodeLine(line);
          assert.ok(row, line);
          return row;
        });

  return discoverImdbCandidates({ titles, names, principals, episodes, now: NOW });
}

function byName(result: DiscoveryResult, displayName: string) {
  const matches = result.candidates.filter((candidate) => candidate.displayName === displayName);
  assert.equal(matches.length, 1, displayName);
  return matches[0];
}

test("given-name tokens are anchored", () => {
  assert.equal(matchSteveGivenName("Stevenson"), null);
  assert.equal(matchSteveGivenName("John Stevenson"), null);
  assert.equal(matchSteveGivenName("Mary Stevens"), null);
  assert.equal(matchSteveGivenName("Bob"), null);
  assert.equal(isEmbeddedSteveFalsePositive("stevenson"), true);
  assert.equal(isEmbeddedSteveFalsePositive("stevens"), true);
  assert.equal(isEmbeddedSteveFalsePositive("steve"), false);

  assert.equal(matchSteveGivenName("Dr. Steven Strange")?.variant, "steven");
  assert.equal(matchSteveGivenName("Stéven Márquez")?.variant, "steven");
  assert.equal(matchSteveGivenName("Steve's neighbor")?.variant, "steve");
  assert.equal(matchPerformerGivenName("Steven Actor")?.variant, "steven");
  assert.equal(matchPerformerGivenName("Steve Director")?.variant, "steve");
  assert.equal(matchPerformerGivenName("Mary Steve Smith"), null);
  assert.equal(matchPerformerGivenName("Bob Guest"), null);

  const credits = parseCharacterCredits('["Stevie","Other Role"]');
  assert.deepEqual(credits, ["Stevie", "Other Role"]);
  assert.equal(matchSteveGivenName(credits[0])?.variant, "stevie");
  assert.equal(matchSteveGivenName(credits[1]), null);
  assert.deepEqual(parseCharacterCredits("\\N"), []);
});

test("short and video are not commercials", () => {
  for (const titleType of ["short", "video", "videoGame"]) {
    const classification = classifyImdbTitleType(titleType);
    assert.equal(classification.disposition, "unresolved");
    if (classification.disposition === "unresolved") {
      assert.match(classification.reason, /not commercials/);
      assert.equal("medium" in classification, false);
    }
  }

  const tvShort = classifyImdbTitleType("tvShort");
  assert.deepEqual(tvShort, { disposition: "candidate", medium: "tv" });
  assert.deepEqual(classifyImdbTitleType("movie"), { disposition: "candidate", medium: "film" });
  assert.deepEqual(classifyImdbTitleType("tvSeries"), { disposition: "candidate", medium: "tv" });

  const tvMovie = classifyImdbTitleType("tvMovie");
  assert.equal(tvMovie.disposition, "candidate");
  if (tvMovie.disposition === "candidate") {
    assert.equal(tvMovie.medium, "tv");
    assert.equal(tvMovie.note, TV_MOVIE_MEDIUM_NOTE);
  }
});

test("synthetic credits reject false Steves and keep real ones", () => {
  const result = loadDiscovery();
  const names = result.candidates.map((candidate) => candidate.displayName).sort();

  assert.equal(result.counts.recordsScanned, 19);
  assert.equal(result.counts.skippedNonPerformer, 1);
  assert.equal(result.unresolved.length, 3);
  assert.deepEqual(
    names,
    [
      "Dr. Steven Strange",
      "Stephen Guest",
      "Steve Harrington",
      "Steve Host",
      "Steve Neighbor",
      "Steve Rogers",
      "Steven Feature",
      "Stevie",
      "Stevie Bit"
    ]
  );
  assert.equal(result.candidates.some((candidate) => candidate.medium === "commercial"), false);
  assert.equal(result.candidates.some((candidate) => candidate.actorOrPerson === "Steven Actor"), false);
  assert.equal(result.candidates.some((candidate) => candidate.actorOrPerson === "Steve Director"), false);
  assert.equal(result.candidates.some((candidate) => candidate.actorOrPerson === "Bob Guest"), false);
  assert.equal(result.sourceTitles.some((title) => title.payload.titleType === "short"), false);
  assert.equal(result.sourceTitles.some((title) => title.payload.titleType === "video"), false);
  assert.equal(result.sourceTitles.some((title) => title.payload.titleType === "videoGame"), false);

  for (const unresolved of result.unresolved) {
    assert.match(unresolved.reason, /not commercials/);
  }

  const strange = byName(result, "Dr. Steven Strange");
  assert.equal(strange.entryType, "character");
  assert.equal(strange.nameVariant, "steven");
  assert.equal(strange.medium, "film");
  assert.equal(strange.payload.characterToken, "dr steven strange");
  assert.equal(strange.payload.sourceType, "character_credit");

  const stevie = byName(result, "Stevie");
  assert.equal(stevie.nameVariant, "stevie");
  assert.equal(stevie.entryType, "character");
  assert.equal(stevie.actorOrPerson, "Pat Multi");
  assert.equal(result.candidates.some((candidate) => candidate.displayName === "Other Role"), false);

  const host = byName(result, "Steve Host");
  assert.equal(host.entryType, "person");
  assert.equal(host.nameVariant, "steve");
  assert.equal(host.matchConfidence, "medium");
  assert.equal(host.payload.sourceType, "self_credit");
  assert.match(host.notesOnUncertainty ?? "", /not a fictional character/);

  const tvMovie = byName(result, "Steven Feature");
  assert.equal(tvMovie.medium, "tv");
  assert.match(tvMovie.notesOnUncertainty ?? "", /tvMovie/);

  const tvShort = byName(result, "Stevie Bit");
  assert.equal(tvShort.medium, "tv");
  assert.equal(tvShort.payload.titleType, "tvShort");

  const stephen = byName(result, "Stephen Guest");
  assert.equal(stephen.nameVariant, "stephen");
});

test("two Steves in different works stay distinct", () => {
  const result = loadDiscovery();
  const rogers = byName(result, "Steve Rogers");
  const neighbor = byName(result, "Steve Neighbor");

  assert.notEqual(rogers.id, neighbor.id);
  assert.notEqual(rogers.imdbTitleId, neighbor.imdbTitleId);
  assert.equal(rogers.medium, "film");
  assert.equal(neighbor.medium, "tv");
  assert.equal(
    rogers.id,
    buildCandidateId({
      provider: "imdb_bulk",
      workOrSeriesId: "tt9000006",
      performerId: "nm9000006",
      characterToken: "steve rogers"
    })
  );
});

test("repeated episodes become one series candidate", () => {
  const grouped = loadDiscovery();
  const harrington = byName(grouped, "Steve Harrington");

  assert.equal(harrington.titleOfWork, "Neighborhood Show");
  assert.equal(harrington.imdbTitleId, "tt9000010");
  assert.equal(harrington.payload.identityResolution, "series_grouped");
  assert.deepEqual(harrington.payload.episodeIds, ["tt9000011", "tt9000012", "tt9000013"]);
  assert.equal(grouped.candidates.filter((candidate) => candidate.displayName === "Steve Harrington").length, 1);

  const ungrouped = loadDiscovery({ episodes: false });
  const episodes = ungrouped.candidates.filter((candidate) => candidate.displayName === "Steve Harrington");
  assert.equal(episodes.length, 3);
  assert.deepEqual(
    episodes.map((candidate) => candidate.imdbTitleId).sort(),
    ["tt9000011", "tt9000012", "tt9000013"]
  );
  assert.equal(episodes.every((candidate) => candidate.payload.identityResolution === "episode_ungrouped"), true);
});

test("a rerun does not reset accepted or rejected candidates", () => {
  const first = loadDiscovery();
  const again = loadDiscovery();
  const harrington = byName(first, "Steve Harrington");
  const rogers = byName(first, "Steve Rogers");
  const strange = byName(first, "Dr. Steven Strange");

  const accepted = {
    ...harrington,
    status: "accepted" as const,
    linkedPublishedEntryId: "entry-neighborhood-steve",
    payload: {
      ...harrington.payload,
      summary: "Keep this editorial note."
    }
  };
  const rejected = {
    ...rogers,
    id: "candidate-legacy-rogers",
    slug: "candidate-legacy-rogers",
    status: "rejected" as const,
    linkedPublishedEntryId: null
  };
  const staleAccepted = overlayDatabaseReviewState(
    { ...strange, status: "pending_review" },
    {
      id: strange.id,
      slug: strange.slug,
      status: "accepted",
      linkedPublishedEntryId: "entry-strange-picture"
    }
  );

  assert.equal(staleAccepted.status, "accepted");
  const merged = reconcileCandidatesWithReviewed(again.candidates, [accepted, rejected, staleAccepted]);

  const harringtonRows = merged.filter((candidate) => candidate.displayName === "Steve Harrington");
  assert.equal(harringtonRows.length, 1);
  assert.equal(harringtonRows[0]?.status, "accepted");
  assert.equal(harringtonRows[0]?.linkedPublishedEntryId, "entry-neighborhood-steve");
  assert.equal(harringtonRows[0]?.id, harrington.id);
  assert.equal(harringtonRows[0]?.payload.summary, "Keep this editorial note.");
  assert.deepEqual(harringtonRows[0]?.payload.episodeIds, ["tt9000011", "tt9000012", "tt9000013"]);

  const rogersRows = merged.filter((candidate) => candidate.displayName === "Steve Rogers");
  assert.equal(rogersRows.length, 1);
  assert.equal(rogersRows[0]?.id, "candidate-legacy-rogers");
  assert.equal(rogersRows[0]?.slug, "candidate-legacy-rogers");
  assert.equal(rogersRows[0]?.status, "rejected");
  assert.equal(rogersRows[0]?.linkedPublishedEntryId, null);

  const strangeRows = merged.filter((candidate) => candidate.displayName === "Dr. Steven Strange");
  assert.equal(strangeRows.length, 1);
  assert.equal(strangeRows[0]?.status, "accepted");
  assert.equal(strangeRows[0]?.linkedPublishedEntryId, "entry-strange-picture");

  const neighbor = merged.find((candidate) => candidate.displayName === "Steve Neighbor");
  assert.equal(neighbor?.status, "pending_review");
  assert.equal(again.candidates.every((candidate) => candidate.status === "pending_review"), true);
});

test("an older episode row is kept instead of inserting a second candidate", () => {
  const first = loadDiscovery();
  const harrington = byName(first, "Steve Harrington");
  const legacy = {
    ...harrington,
    id: "candidate-legacy-episode",
    slug: "candidate-legacy-episode",
    status: "accepted" as const,
    linkedPublishedEntryId: "entry-neighborhood-steve",
    imdbTitleId: "tt9000011",
    payload: {
      displayName: "Steve Harrington"
    }
  };

  const merged = reconcileCandidatesWithReviewed(loadDiscovery().candidates, [legacy]);
  const rows = merged.filter((candidate) => candidate.displayName === "Steve Harrington");

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, "candidate-legacy-episode");
  assert.equal(rows[0]?.status, "accepted");
  assert.equal(rows[0]?.linkedPublishedEntryId, "entry-neighborhood-steve");
  assert.deepEqual(rows[0]?.payload.episodeIds, ["tt9000011", "tt9000012", "tt9000013"]);
});

test("missing IMDB_BULK_DIR still fails with the current error", () => {
  const env = { ...process.env };
  delete env.IMDB_BULK_DIR;
  delete env.DATABASE_URL;

  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/ingest-imdb-bulk.ts"], {
    cwd: repoRoot,
    encoding: "utf8",
    env
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Set IMDB_BULK_DIR to a directory containing title\.basics\.tsv, title\.principals\.tsv, and name\.basics\.tsv\./
  );
});

test("dry-run does not write when DATABASE_URL is set", { timeout: 30_000 }, () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/ingest-imdb-bulk.ts", "--dry-run"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      IMDB_BULK_DIR: fixtureDir,
      DATABASE_URL: "postgres://127.0.0.1:1/as_steve_on_tv_should_not_connect"
    }
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /IMDb ingest dry run complete\./);
  assert.match(result.stdout, /candidates: 9/);
  assert.match(result.stdout, /unresolved titles: 3/);
  assert.match(result.stdout, /title\.episode\.tsv: used/);
  assert.match(result.stdout, /tt9000003\tshort\tShort Steve/);
  assert.match(result.stdout, /tt9000004\tvideo\tVideo Steve/);
  assert.doesNotMatch(result.stdout, /IMDb ingest completed/);
  assert.doesNotMatch(result.stdout, /upserted/);
});
