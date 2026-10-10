import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

import { runFeasibilityPilot } from "../../src/lib/data/coverage";
import { discoverImdbCandidates } from "../../src/lib/data/normalize-character";
import { assertPrivateResearchPath, assertStudyCatalogPath } from "../../src/lib/data/research-paths";
import {
  checksumTextFiles,
  observeBirthName,
  observationsInStudyWindow,
  parseSsaTexts,
  parseSsaZip,
  ssaSummaryLines,
  type SsaTextFile
} from "../../src/lib/data/ssa";
import { classifyStudyCredit } from "../../src/lib/data/study-credits";
import { FEASIBILITY_PROTOCOL, selectFeasibilitySample, withProtocol } from "../../src/lib/data/study-sample";
import {
  birthNameCountSchema,
  steveEntrySchema,
  studyCatalogSchema,
  studyMetricSchema,
  studyProtocolSchema,
  type StudyCatalog,
  type StudyCatalogTitle
} from "../../src/lib/schema";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NOW = "2026-10-10T00:00:00Z";
const RELEASE = "2026-05-08";

const catalog = studyCatalogSchema.parse(
  JSON.parse(readFileSync(path.join(repoRoot, "tests", "fixtures", "study", "catalog.json"), "utf8"))
);

function film(providerId: string, title: string, votes: number, genre: string, year = 1965): StudyCatalogTitle {
  return {
    provider: "imdb",
    providerId,
    title,
    titleType: "movie",
    year,
    genres: [genre],
    votes
  };
}

function loadPilot() {
  return runFeasibilityPilot({ catalog, now: NOW });
}

function creditNamed(pilot: ReturnType<typeof loadPilot>, performerId: string, creditedName: string) {
  const matches = pilot.credits.filter((credit) => credit.performerId === performerId && credit.creditedName === creditedName);
  assert.equal(matches.length, 1);
  return matches[0];
}

function zipArchive(files: { name: string; data: Buffer }[], method: 0 | 8): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name);
    const payload = method === 8 ? deflateRawSync(file.data) : file.data;
    const checksum = crc32(file.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    const localRecord = Buffer.concat([local, name, payload]);
    locals.push(localRecord);
    centrals.push(Buffer.concat([central, name]));
    offset += localRecord.length;
  }

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, eocd]);
}

function ssaFiles(): SsaTextFile[] {
  return [
    { name: "yob1959.txt", text: "Steve,M,20\n" },
    {
      name: "yob1960.txt",
      text: ["name,sex,count", "Steve,M,100", "Steve,M,50", "Steven,M,40", "Steve,F,8", "Tiny,M,3", "Zero,M,0", "Four,F,4", "Five,M,5", "John,M,500"].join("\n")
    },
    { name: "yob1962.txt", text: "Steve,M,90\n" },
    { name: "yob2026.txt", text: "Steve,M,10\n" }
  ];
}

function importSsa(files = ssaFiles(), releaseDate = RELEASE) {
  return parseSsaTexts(files, {
    releaseDate,
    retrievedAt: NOW,
    contentSha256: checksumTextFiles(files)
  });
}

test("SSA counts under 5 and missing years stay suppressed instead of zero", () => {
  const imported = importSsa();
  const steve = observeBirthName(imported.observations, "Steve", "M", 1960);
  const steven = observeBirthName(imported.observations, "Steven", "M", 1960);
  const steveFemale = observeBirthName(imported.observations, "Steve", "F", 1960);
  const missing = observeBirthName(imported.observations, "Steve", "M", 1961);
  const stevie = observeBirthName(imported.observations, "Stevie", "M", 1960);
  const tiny = observeBirthName(imported.observations, "Tiny", "M", 1960);
  const zero = observeBirthName(imported.observations, "Zero", "M", 1960);
  const four = observeBirthName(imported.observations, "Four", "F", 1960);
  const five = observeBirthName(imported.observations, "Five", "M", 1960);
  const later = observeBirthName(imported.observations, "Steve", "M", 2025);
  const filed2026 = observeBirthName(imported.observations, "Steve", "M", 2026);

  assert.equal(steve?.count, 100);
  assert.equal(steve?.sex, "M");
  assert.equal(steve?.observationState, "reported");
  assert.equal(steven?.count, 40);
  assert.equal(steveFemale?.count, 8);
  assert.equal(five?.count, 5);
  assert.equal(missing?.observationState, "suppressed_or_absent");
  assert.equal(missing?.count, null);
  assert.equal(stevie?.count, null);
  assert.equal(tiny?.count, null);
  assert.equal(tiny?.observationState, "suppressed_or_absent");
  assert.equal(zero?.count, null);
  assert.equal(four?.count, null);
  assert.equal(four?.sex, "F");
  assert.equal(later?.count, null);
  assert.notEqual(later?.count, 100);
  assert.equal(filed2026?.count, 10);
  assert.equal(observationsInStudyWindow(imported.observations).some((row) => row.birthYear === 2026), false);
  assert.equal(observationsInStudyWindow(imported.observations).some((row) => row.birthYear === 1959), false);
  assert.equal(observeBirthName(imported.observations, "Steve", "M", 2027), undefined);
  assert.equal(imported.observations.some((row) => row.count === 0), false);
  assert.equal(imported.observations.some((row) => row.name.includes("/")), false);
  assert.equal(imported.snapshot.importedRowCounts.invalidRows, 1);
  assert.equal(imported.snapshot.importedRowCounts.duplicateRows, 1);
  assert.equal(ssaSummaryLines(imported).includes("numeric zero counts: 0"), true);
  assert.throws(() => birthNameCountSchema.parse({ ...steve, count: 0 }));
  assert.throws(() => birthNameCountSchema.parse({ ...steve, count: null, observationState: "reported" }));
});

test("the same SSA file and release date rebuild the same ids", () => {
  const first = importSsa();
  const second = importSsa();
  const shifted = importSsa(ssaFiles(), "2026-05-09");

  assert.deepEqual(
    first.observations.map((row) => row.id),
    second.observations.map((row) => row.id)
  );
  assert.equal(first.snapshot.id, second.snapshot.id);
  assert.equal(first.snapshot.contentSha256, checksumTextFiles(ssaFiles()));
  assert.notEqual(shifted.snapshot.id, first.snapshot.id);
  assert.equal(shifted.snapshot.contentSha256, first.snapshot.contentSha256);
  assert.throws(() => importSsa(ssaFiles(), "2026-02-31"));
  assert.throws(() => parseSsaTexts([], { releaseDate: RELEASE, retrievedAt: NOW, contentSha256: "abc" }));
});

test("stored and deflated SSA zips keep sex and do not invent a zero", () => {
  const text = Buffer.from("Steve,M,12\nSteven,F,4\n");

  for (const method of [0, 8] as const) {
    const imported = parseSsaZip(zipArchive([{ name: "yob1960.txt", data: text }], method), {
      releaseDate: RELEASE,
      retrievedAt: NOW
    });
    assert.equal(observeBirthName(imported.observations, "Steve", "M", 1960)?.count, 12);
    assert.equal(observeBirthName(imported.observations, "Steven", "F", 1960)?.count, null);
    assert.equal(imported.observations.some((row) => row.count === 0), false);
  }
});

test("the feasibility protocol freezes 1960-2025 and requests the pilot quotas", () => {
  const documented = studyProtocolSchema.parse(
    JSON.parse(readFileSync(path.join(repoRoot, "research", "studies", "steve-extinction-feasibility.json"), "utf8"))
  );

  assert.deepEqual(documented, FEASIBILITY_PROTOCOL);
  assert.equal(documented.filmsPerDecade, 100);
  assert.equal(documented.seriesPerDecade, 50);
  assert.equal(documented.primaryOutcomeCalculated, false);
  assert.throws(() =>
    studyProtocolSchema.parse({
      ...FEASIBILITY_PROTOCOL,
      window: { startYear: 1960, endYear: 2026 }
    })
  );
  assert.throws(() =>
    studyMetricSchema.parse({
      id: "metric-incomplete-rate",
      studyId: documented.id,
      decade: 1960,
      medium: "film",
      variantLabel: "steve",
      numerator: 1,
      denominator: null,
      rate: 1,
      uncertaintyLow: null,
      uncertaintyHigh: null,
      calculationVersion: "not-in-phase-3",
      createdAt: NOW
    })
  );
});

test("the feasibility pilot records completeness without inventing works or a Steve rate", () => {
  const pilot = loadPilot();
  const csv = readFileSync(path.join(repoRoot, "tests", "fixtures", "study", "feasibility-completeness.csv"), "utf8");
  const film1960 = pilot.report.rows.find((row) => row.decade === 1960 && row.medium === "film");
  const tv1970 = pilot.report.rows.find((row) => row.decade === 1970 && row.medium === "tv");
  const empty = pilot.report.rows.find((row) => row.decade === 1980 && row.medium === "film");
  const steve = creditNamed(pilot, "nm1", "Steve Rogers");
  const bob = creditNamed(pilot, "nmsteven", "Bob");
  const harbor = creditNamed(pilot, "nm7", "Steve Harrington");
  const namesake = creditNamed(pilot, "nm8", "Steve Harrington");
  const robert = creditNamed(pilot, "nm9", "Robert Guest");
  const harborIntro = pilot.introductions.find((introduction) => introduction.creditId === harbor.id);

  assert.equal(pilot.csv, csv);
  assert.equal(pilot.csv.includes("per_1000"), false);
  assert.equal(pilot.report.primaryOutcomeCalculated, false);
  assert.equal(film1960?.worksRequested, 100);
  assert.equal(film1960?.worksAvailable, 4);
  assert.equal(film1960?.worksSelected, 4);
  assert.equal(film1960?.quotaShortfall, 96);
  assert.equal(film1960?.worksWithParsableNamedCredits, 3);
  assert.equal(film1960?.shareOfSelectedWorksWithParsableNamedCredits, 0.75);
  assert.equal(film1960?.namedCredits, 4);
  assert.equal(film1960?.steveFamilyCredits, 1);
  assert.equal(film1960?.controlNameCredits, 1);
  assert.equal(film1960?.otherNamedCredits, 2);
  assert.equal(tv1970?.introductionsWithDebut, 1);
  assert.equal(tv1970?.excludedMissingDebut, 2);
  assert.equal(tv1970?.groupedEpisodeCredits, 1);
  assert.equal(empty?.worksSelected, 0);
  assert.equal(empty?.shareOfSelectedWorksWithParsableNamedCredits, null);
  assert.equal(pilot.selections.filter((selection) => selection.included).length, 5);
  assert.equal(pilot.selections.every((selection) => selection.included === false || selection.reason === "feasibility_census"), true);
  assert.equal(bob.variantLabel, "other");
  assert.equal(bob.publicCandidate, false);
  assert.equal(creditNamed(pilot, "nm6", "Stevenson").variantLabel, "other");
  assert.equal(creditNamed(pilot, "nm2", "John Doe").variantLabel, "john");
  assert.equal(pilot.credits.find((credit) => credit.creditedName === "Self")?.eligible, false);
  assert.equal(steve.variantLabel, "steve");
  assert.equal(pilot.introductions.find((introduction) => introduction.creditId === steve.id)?.provenance, "film_release_year_proxy");
  assert.equal(harbor.episodeIds.join(","), "tte1,tte2");
  assert.equal(harborIntro?.firstAppearanceYear, 1974);
  assert.equal(harborIntro?.provenance, "earliest_verified_episode_year");
  assert.notEqual(harbor.identityKey, namesake.identityKey);
  assert.equal(pilot.introductions.some((introduction) => introduction.creditId === namesake.id), false);
  assert.equal(pilot.introductions.some((introduction) => introduction.creditId === robert.id), false);
  assert.equal(pilot.credits.some((credit) => credit.creditedName === "Steve Ancient"), false);
  assert.deepEqual(pilot.report.possibleNamesakes, [
    { workProviderId: "ttharbor", normalizedName: "steve harrington", performerIds: ["nm7", "nm8"] }
  ]);
  assert.deepEqual(pilot.report.titleExclusions, {
    beyond_frozen_cutoff: 1,
    episode_not_a_sampling_unit: 4,
    not_a_series_sampling_unit: 1,
    outside_study_window: 1,
    tv_movie_not_in_feasibility_panels: 1,
    unresolved_medium: 1
  });
  assert.equal(pilot.credits.every((credit) => credit.publicCandidate === false), true);
  assert.equal("candidates" in pilot, false);
});

test("study extraction keeps non-Steves private while discovery still ignores them", () => {
  const pilot = loadPilot();
  const titles = catalog.titles.flatMap((title) =>
    title.year === undefined
      ? []
      : [{ tconst: title.providerId, titleType: title.titleType, primaryTitle: title.title, startYear: title.year }]
  );
  const discovered = discoverImdbCandidates({
    titles,
    names: catalog.names,
    principals: catalog.principals,
    episodes: catalog.episodes,
    now: NOW
  });
  const names = discovered.candidates.map((candidate) => candidate.displayName).sort();

  assert.deepEqual(names, ["Steve Ancient", "Steve Harrington", "Steve Rogers"]);
  assert.equal(pilot.credits.some((credit) => credit.creditedName === "John Doe"), true);
  assert.equal(discovered.unresolved.some((row) => row.tconst === "ttshort" && row.reason.includes("not commercials")), true);
});

test("sampling is deterministic, stratified, and blind to character names", () => {
  const protocol = withProtocol({ id: "study-stratification-check", filmsPerDecade: 2, seriesPerDecade: 1 });
  const titles = [
    film("ttD1", "Drama High", 100, "Drama"),
    film("ttD2", "Drama Low", 90, "Drama"),
    film("ttC1", "Comedy High", 5, "Comedy"),
    film("ttC2", "Comedy Low", 4, "Comedy")
  ];
  const forward = selectFeasibilitySample({ titles, protocol, now: NOW });
  const reversed = selectFeasibilitySample({ titles: [...titles].reverse(), protocol, now: NOW });
  const selected = (result: ReturnType<typeof selectFeasibilitySample>) =>
    result.selections
      .filter((selection) => selection.included)
      .map((selection) => selection.providerId)
      .sort();

  assert.deepEqual(selected(forward), ["ttC1", "ttD1"]);
  assert.deepEqual(selected(reversed), selected(forward));

  const named = selectFeasibilitySample({
    titles: [film("ttLow", "Steve Story", 1, "Drama"), film("ttHigh", "Bob Story", 50, "Drama")],
    protocol: withProtocol({ id: "study-title-independence", filmsPerDecade: 1 }),
    now: NOW
  });
  const renamed = selectFeasibilitySample({
    titles: [film("ttLow", "Bob Story", 1, "Drama"), film("ttHigh", "Steve Story", 50, "Drama")],
    protocol: withProtocol({ id: "study-title-independence", filmsPerDecade: 1 }),
    now: NOW
  });

  assert.deepEqual(selected(named), ["ttHigh"]);
  assert.deepEqual(selected(renamed), ["ttHigh"]);

  const census = runFeasibilityPilot({
    catalog: { titles: [film("ttOnly", "Only Film", 3, "Drama")], principals: [], episodes: [], names: [] },
    now: NOW
  });
  const row = census.report.rows.find((candidate) => candidate.decade === 1960 && candidate.medium === "film");

  assert.equal(row?.worksSelected, 1);
  assert.equal(row?.quotaShortfall, 99);
  assert.deepEqual(
    census.selections.filter((selection) => selection.included).map((selection) => selection.providerId),
    ["ttOnly"]
  );
});

test("repeated roles and missing TV debuts follow the study rules", () => {
  const compound = runFeasibilityPilot({
    catalog: {
      titles: [film("ttCompound", "Compound", 10, "Drama", 1971)],
      principals: [
        { tconst: "ttCompound", nconst: "nm1", category: "actor", job: "", characters: "[\"Stevie\", \"Other Role\"]" },
        { tconst: "ttCompound", nconst: "nm2", category: "actor", job: "", characters: "[\"Dr. Steven Strange\"]" },
        { tconst: "ttCompound", nconst: "nm3", category: "actor", job: "", characters: "[\"Dr. John Smith\"]" },
        { tconst: "ttCompound", nconst: "nm4", category: "actor", job: "", characters: "[\"Mary John\"]" }
      ],
      episodes: [],
      names: []
    },
    now: NOW
  });

  assert.deepEqual(
    compound.credits.map((credit) => [credit.creditedName, credit.variantLabel, credit.givenNameToken]).sort(),
    [
      ["Dr. John Smith", "john", "john"],
      ["Dr. Steven Strange", "steven", "steven"],
      ["Mary John", "other", "mary"],
      ["Other Role", "other", "other"],
      ["Stevie", "stevie", "stevie"]
    ]
  );
  assert.equal(compound.introductions.length, 5);
  assert.equal(classifyStudyCredit("Stevenson")?.label, "other");
  assert.equal(classifyStudyCredit("Dr. Steven Strange")?.label, "steven");
});

test("research output cannot be written into the public app or built from the index", () => {
  assert.throws(() => assertPrivateResearchPath(repoRoot, path.join(repoRoot, "content", "public", "studies")));
  assert.throws(() => assertStudyCatalogPath(repoRoot, path.join(repoRoot, "content", "entries", "steve.json")));
  assert.doesNotThrow(() => assertPrivateResearchPath(repoRoot, path.join(tmpdir(), "ssa-out")));
});

test("study migration records suppression and does not drop earlier tables", () => {
  const sql = readFileSync(path.join(repoRoot, "db", "migrations", "0003_steve_studies.sql"), "utf8");

  assert.match(sql, /observation_state = 'suppressed_or_absent' and count is null/);
  assert.match(sql, /public_candidate = false/);
  assert.match(sql, /first_appearance_year between 1960 and 2025/);
  assert.match(sql, /create table if not exists study_metric/);
  assert.doesNotMatch(sql, /drop table/i);
});

test("published entries stay unchanged", () => {
  const entryDir = path.join(repoRoot, "content", "entries");
  const files = readdirSync(entryDir).filter((file) => file.endsWith(".json"));

  assert.equal(files.length, 11);

  for (const file of files) {
    const parsed = steveEntrySchema.parse(JSON.parse(readFileSync(path.join(entryDir, file), "utf8")));
    assert.equal(parsed.identityId, undefined);
  }
});

test("SSA and feasibility commands stay private and dry-run by default", () => {
  const tsx = path.join(repoRoot, "node_modules", ".bin", "tsx");
  const missing = spawnSync(tsx, ["scripts/ingest-ssa.ts"], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--file/);

  const directory = mkdtempSync(path.join(tmpdir(), "ssa-"));
  const out = mkdtempSync(path.join(tmpdir(), "ssa-out-"));
  writeFileSync(path.join(directory, "yob1960.txt"), "Steve,M,4\n");

  try {
    const dryRun = spawnSync(tsx, ["scripts/ingest-ssa.ts", "--file", directory, "--release-date", RELEASE], {
      cwd: repoRoot,
      encoding: "utf8"
    });
    assert.equal(dryRun.status, 0);
    assert.match(dryRun.stdout, /numeric zero counts: 0/);
    assert.match(dryRun.stdout, /suppressed or absent rows:/);
    assert.match(dryRun.stdout, /wrote nothing/);

    const written = spawnSync(
      tsx,
      ["scripts/ingest-ssa.ts", "--file", directory, "--release-date", RELEASE, "--write", "--out", out],
      { cwd: repoRoot, encoding: "utf8" }
    );
    assert.equal(written.status, 0);
    const snapshotDir = readdirSync(out)[0];
    const jsonl = readFileSync(path.join(out, snapshotDir ?? "", "birth-name-count.jsonl"), "utf8");
    assert.match(jsonl, /"count":null/);
    assert.doesNotMatch(jsonl, /"count":0/);

    const forbidden = path.join(repoRoot, "content", "public", "ssa-phase3-test");
    const refused = spawnSync(
      tsx,
      ["scripts/ingest-ssa.ts", "--file", directory, "--release-date", RELEASE, "--write", "--out", forbidden],
      { cwd: repoRoot, encoding: "utf8" }
    );
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /Refusing to write/);
    assert.equal(existsSync(forbidden), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
    rmSync(path.join(repoRoot, "content", "public", "ssa-phase3-test"), { recursive: true, force: true });
  }

  const pilot = spawnSync(
    tsx,
    ["scripts/build-feasibility-pilot.ts", "--catalog", path.join(repoRoot, "tests", "fixtures", "study", "catalog.json")],
    { cwd: repoRoot, encoding: "utf8" }
  );
  assert.equal(pilot.status, 0);
  assert.match(pilot.stdout, /primary outcome calculated: false/);
  assert.match(pilot.stdout, /1960,film,100,4,4,96,3,0\.7500/);
  assert.match(pilot.stdout, /wrote nothing/);
  assert.doesNotMatch(pilot.stdout, /per_1000/);

  const fromIndex = spawnSync(
    tsx,
    ["scripts/build-feasibility-pilot.ts", "--catalog", path.join(repoRoot, "content", "entries", "steve-harrington-stranger-things.json")],
    { cwd: repoRoot, encoding: "utf8" }
  );
  assert.equal(fromIndex.status, 1);
  assert.match(fromIndex.stderr, /public index/);
});

test("a second pilot run keeps the same credit and introduction ids", () => {
  const first = loadPilot();
  const shuffled: StudyCatalog = {
    ...catalog,
    titles: [...catalog.titles].reverse(),
    principals: [...catalog.principals].reverse()
  };
  const second = runFeasibilityPilot({ catalog: shuffled, now: NOW });

  assert.deepEqual(
    first.credits.map((credit) => credit.id),
    second.credits.map((credit) => credit.id)
  );
  assert.deepEqual(
    first.introductions.map((introduction) => introduction.id),
    second.introductions.map((introduction) => introduction.id)
  );
  assert.equal(createHash("sha256").update(first.csv).digest("hex"), createHash("sha256").update(second.csv).digest("hex"));
});
