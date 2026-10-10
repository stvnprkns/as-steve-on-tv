import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  appendReviewAction,
  commitIdentityPlan,
  emptyIdentityRegistry,
  markCandidateReview,
  resolveCandidateIdentity
} from "../../src/lib/data/identity-resolution";
import { reconcileCandidatesWithReviewed } from "../../src/lib/data/normalize-character";
import {
  discoverImdbCandidates,
  parseEpisodeLine,
  parseNameBasicsLine,
  parsePrincipalLine,
  parseTitleBasicsLine
} from "../../src/lib/data/normalize-character";
import { steveEntrySchema, type CandidateEntry } from "../../src/lib/schema";

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

function loadDiscovery() {
  const titles = loadLines("title.basics.tsv").map((line) => {
    const row = parseTitleBasicsLine(line);
    assert.ok(row);
    return row;
  });
  const names = loadLines("name.basics.tsv").map((line) => {
    const row = parseNameBasicsLine(line);
    assert.ok(row);
    return row;
  });
  const principals = loadLines("title.principals.tsv").map((line) => {
    const row = parsePrincipalLine(line);
    assert.ok(row);
    return row;
  });
  const episodes = loadLines("title.episode.tsv").map((line) => {
    const row = parseEpisodeLine(line);
    assert.ok(row);
    return row;
  });

  return discoverImdbCandidates({ titles, names, principals, episodes, now: NOW });
}

function byName(displayName: string) {
  const matches = loadDiscovery().candidates.filter((candidate) => candidate.displayName === displayName);
  assert.equal(matches.length, 1);
  return matches[0];
}

test("existing entries stay valid and optional identity fields are not required", () => {
  const entryDir = path.join(repoRoot, "content", "entries");
  const files = readdirSync(entryDir).filter((file) => file.endsWith(".json"));
  assert.equal(files.length, 11);

  for (const file of files) {
    const parsed = steveEntrySchema.parse(JSON.parse(readFileSync(path.join(entryDir, file), "utf8")));
    assert.equal(parsed.identityId, undefined);
    assert.equal(parsed.imageRights, undefined);
  }

  const harrington = steveEntrySchema.parse(JSON.parse(readFileSync(path.join(entryDir, "steve-harrington-stranger-things.json"), "utf8")));
  const withIdentity = steveEntrySchema.parse({
    ...harrington,
    identityId: "identity-harrington",
    sourceIds: ["evidence-harrington"],
    representationType: "fictional_character",
    productionIds: ["tt4574334"],
    researchLinkIds: ["study-link-harrington"],
    firstConfirmedAppearance: { year: 2016, precision: "year", verified: true },
    imageRights: { displayAllowed: false, licenseBasis: "not-authorized" }
  });

  assert.equal(withIdentity.slug, harrington.slug);
  assert.equal(withIdentity.imageRights?.displayAllowed, false);
  assert.throws(() =>
    steveEntrySchema.parse({
      ...harrington,
      firstConfirmedAppearance: { year: 2016, precision: "day", verified: false }
    })
  );
});

test("the same credited name in another work stays a separate identity", () => {
  const series = byName("Steve Harrington");
  const first = resolveCandidateIdentity({ candidate: series, now: NOW });
  assert.equal(first.disposition, "new_identity");
  assert.equal(first.appearances.length, 3);
  assert.equal(first.rewritesPublishedSlug, false);
  assert.ok(first.identity);

  const registry = commitIdentityPlan(emptyIdentityRegistry(), first);
  const film: CandidateEntry = {
    ...series,
    id: "candidate-film-harrington",
    slug: "candidate-film-harrington",
    medium: "film",
    titleOfWork: "Harrington Picture",
    actorOrPerson: "Other Actor",
    imdbTitleId: "tt9000088",
    imdbNameId: "nm9000099",
    payload: {
      ...series.payload,
      performerId: "nm9000099",
      workOrSeriesId: "tt9000088",
      episodeIds: [],
      titleType: "movie",
      characterToken: "steve harrington"
    }
  };
  const second = resolveCandidateIdentity({ candidate: film, registry, now: NOW });

  assert.equal(second.disposition, "new_identity");
  assert.notEqual(second.identity?.id, first.identity.id);
  assert.deepEqual(second.relatedIdentityIds, [first.identity.id]);
  assert.equal(second.appearances.length, 1);
  assert.equal(second.appearances[0]?.workId === first.appearances[0]?.workId, false);
});

test("one actor playing two Steves does not become one appearance", () => {
  const series = byName("Steve Harrington");
  const registry = commitIdentityPlan(emptyIdentityRegistry(), resolveCandidateIdentity({ candidate: series, now: NOW }));
  const otherRole: CandidateEntry = {
    ...series,
    id: "candidate-same-actor-rogers",
    slug: "candidate-same-actor-rogers",
    displayName: "Steve Rogers",
    canonicalName: "Steve Rogers",
    matchedName: "Steve Rogers",
    titleOfWork: "Rogers Picture",
    medium: "film",
    imdbTitleId: "tt9000006",
    payload: {
      ...series.payload,
      displayName: "Steve Rogers",
      characterToken: "steve rogers",
      workOrSeriesId: "tt9000006",
      episodeIds: [],
      titleType: "movie"
    }
  };
  const plan = resolveCandidateIdentity({ candidate: otherRole, registry, now: NOW });

  assert.equal(plan.disposition, "new_identity");
  assert.deepEqual(plan.relatedIdentityIds, []);
  assert.notEqual(plan.identity?.originWorkId, "tt9000010");
});

test("series episodes share one identity and a film credit does not join them", () => {
  const series = byName("Steve Harrington");
  const opened = resolveCandidateIdentity({ candidate: series, now: NOW });
  const registry = commitIdentityPlan(emptyIdentityRegistry(), opened);
  const duplicate = resolveCandidateIdentity({ candidate: series, registry, now: NOW });

  assert.equal(duplicate.disposition, "duplicate");
  assert.equal(duplicate.appearances.length, 0);
  assert.equal(commitIdentityPlan(registry, duplicate), registry);

  const extra: CandidateEntry = {
    ...series,
    payload: {
      ...series.payload,
      episodeIds: ["tt9000011", "tt9000012", "tt9000013", "tt9000014"]
    }
  };
  const appearance = resolveCandidateIdentity({ candidate: extra, registry, now: NOW });

  assert.equal(appearance.disposition, "new_appearance");
  assert.equal(appearance.identity?.id, opened.identity?.id);
  assert.equal(appearance.appearances.length, 1);
  assert.equal(appearance.evidence.every((item) => item.displayAllowed === false), true);
  assert.equal(appearance.evidence.every((item) => item.publishedEntryId === undefined), true);
});

test("a published slug is cited and left unchanged", () => {
  const series = byName("Steve Harrington");
  const published = [
    {
      id: "steve-harrington-stranger-things",
      slug: "steve-harrington-stranger-things",
      displayName: "Steve Harrington",
      canonicalName: "Steve Harrington"
    }
  ];
  const snapshot = structuredClone(published);
  const plan = resolveCandidateIdentity({ candidate: series, publishedEntries: published, now: NOW });

  assert.deepEqual(published, snapshot);
  assert.equal(plan.rewritesPublishedSlug, false);
  assert.equal(plan.publishedCitations[0]?.slug, "steve-harrington-stranger-things");
  assert.equal(plan.evidence[0]?.publishedEntryId, undefined);
  assert.equal(series.slug.startsWith("candidate-"), true);
});

test("self credits need evidence and Stevenson is out of scope", () => {
  const host = byName("Steve Host");
  const selfPlan = resolveCandidateIdentity({ candidate: host, now: NOW });
  assert.equal(selfPlan.disposition, "needs_evidence");
  assert.equal(selfPlan.provisional, true);
  assert.equal(selfPlan.identity?.representation, "self");
  assert.equal(commitIdentityPlan(emptyIdentityRegistry(), selfPlan).identities.length, 0);

  const series = byName("Steve Harrington");
  const stevenson: CandidateEntry = {
    ...series,
    displayName: "John Stevenson",
    canonicalName: "John Stevenson",
    matchedName: "John Stevenson",
    payload: {
      ...series.payload,
      characterToken: "john stevenson",
      episodeIds: []
    }
  };
  const out = resolveCandidateIdentity({ candidate: stevenson, now: NOW });
  assert.equal(out.disposition, "out_of_scope");
  assert.equal(out.identity, null);
});

test("review actions are append-only and do not rewrite a candidate slug", () => {
  const series = byName("Steve Harrington");
  const marked = markCandidateReview({
    candidate: series,
    disposition: "new_identity",
    moderator: "editor",
    reason: "Distinct series character.",
    actionId: "review-action-harrington",
    createdAt: NOW
  });

  assert.equal(marked.candidate.slug, series.slug);
  assert.equal(marked.candidate.id, series.id);
  assert.equal(marked.candidate.reviewDisposition, "new_identity");
  assert.equal(marked.candidate.status, "pending_review");
  assert.equal(marked.log.length, 1);
  assert.throws(() => appendReviewAction(marked.log, marked.log[0]), /cannot be rewritten/);

  const again = appendReviewAction(marked.log, {
    ...marked.log[0],
    id: "review-action-harrington-note",
    reason: "Second note, not an edit of the first."
  });
  assert.equal(marked.log.length, 1);
  assert.equal(again.length, 2);
});

test("a rerun keeps a saved review disposition", () => {
  const series = byName("Steve Harrington");
  const saved: CandidateEntry = {
    ...series,
    status: "accepted",
    reviewDisposition: "new_identity",
    identityId: "identity-kept-harrington",
    linkedPublishedEntryId: "steve-harrington-stranger-things"
  };
  const incoming = byName("Steve Harrington");
  const merged = reconcileCandidatesWithReviewed([incoming], [saved]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.status, "accepted");
  assert.equal(merged[0]?.reviewDisposition, "new_identity");
  assert.equal(merged[0]?.identityId, "identity-kept-harrington");
  assert.equal(merged[0]?.slug, saved.slug);
});
