# Data implementation plan

Policy lives in [data-strategy.md](data-strategy.md). This file is the repo gap list and the five-stage build sequence. Phases 1, 2, 3, and 4 are implemented. Phase 5 is specified here and is not built.

## What this phase changes

Phase 1 repairs private IMDb discovery and records the evidence gap. It does not rebuild the site, publish candidates, invent sightings, or start the extinction story.

Shipped in this change:

- `docs/data-strategy.md` — the specification, stored unchanged.
- `npm run data:audit` and `docs/evidence-audit.md` — every `example.com` evidence URL, plus medium and match notes. The command rewrites only that report.
- `src/lib/data/name-variants.ts` and `src/lib/data/normalize-character.ts` — parsing, anchored given names, medium classification, deterministic ids, episode grouping, and reviewed-status preservation.
- `scripts/ingest-imdb-bulk.ts` — calls those functions. `--dry-run` does not write, even when `DATABASE_URL` is set. A missing `IMDB_BULK_DIR` still fails with `Set IMDB_BULK_DIR to a directory containing title.basics.tsv, title.principals.tsv, and name.basics.tsv.` `title.episode.tsv` is used when it is present.
- Candidate upserts keep an existing reviewed `status` and `linkedPublishedEntryId`. A reviewed row with the same IMDb title, person, and character is updated in place instead of inserted again.
- Synthetic fixtures in `tests/fixtures/ingest/` and `node:test` coverage via `npm run test:ingest`.

Not changed: `content/entries/`, `content/submissions/`, `content/candidates/`, `content/public/`, slugs, editorial copy, collections, and the public manifest.

## What is reused

These stay the canonical product surface and do not need a replacement:

- Next.js App Router, Zod, and repo JSON under `content/`.
- `SteveEntry` in `src/lib/schema/steve-entry.ts`, plus candidate, source-title, source-person, and ingest-run schemas in `src/lib/schema/ingest.ts`.
- Filesystem and Postgres repositories in `src/lib/content/repository.ts` and `src/lib/content/repository-postgres.ts`.
- `db/migrations/0001_imdb_ingest.sql`, left unchanged. Phase 2 appends `db/migrations/0002_data_provenance.sql`.
- `npm run validate:content`, `npm run generate:artifacts`, and `npm run build`.
- Published routes, collections, submissions, and the admin review queue.
- `isFixtureUrl` in `src/lib/archive.ts`, which already treats `example.com` as a fixture.

Hand-authored files in `content/candidates/` and every file in `content/entries/` are left as written. New candidate ids are hashes. They are not applied retroactively to those files.

## Gaps this phase closes

The defects were in `scripts/ingest-imdb-bulk.ts`:

1. `normalizeMedium()` treated any `titleType` containing `short` or `video` as `commercial`. `tvShort` was at risk of the same substring bug. Commercial is never inferred from IMDb type. `short`, `video`, and `videoGame` are reported as unresolved and are not stored. `movie` stays `film`. `tvSeries`, `tvMiniSeries`, `tvEpisode`, `tvSpecial`, and `tvShort` stay `tv`. `tvMovie` stays `tv` until a later schema can store film plus a distribution attribute without relabeling existing rows.
2. `detectSteveName(characters || job || person.primaryName)` treated actor names and crew jobs as fictional Steves. The principals reader also skipped a column, so `job` and `characters` were misaligned. Fictional matches now come only from parsed character credits on `actor` / `actress` rows. A `self` credit becomes a `person` candidate only when the performer's own given name is Steve, Steven, Stephen, or Stevie, and it carries an uncertainty note. It is never a fictional character.
3. Character text is parsed as a JSON array. `\N`, empty fields, accents, parentheticals, and possessives are handled. Given-name tokens are anchored: `Stevenson` and `Stevens` do not match; `Dr. Steven Strange` and `["Stevie", "Other Role"]` do. There is no fallback to `job` or the performer's name for a fictional match.
4. Candidate ids were `candidate-${slug}` from display text plus title, so two Steves in one work could collide and repeated episodes did not group. Ids are now a SHA-256 prefix of provider, work-or-series id, performer id, and normalized character token. `title.episode.tsv` groups episodes of one series character into one candidate and stores episode ids on `payload`.
5. Postgres `on conflict` overwrote `status`. Reviewed statuses (`under_review`, `accepted`, `rejected`, `merged`, `needs_more_evidence`) and a non-null `linkedPublishedEntryId` survive a rerun, including when the stored JSON still says `pending_review` but the status column was already reviewed. `acceptCandidate` now writes `status` into that JSON as well.

Still true, and left in place on purpose: every published entry and both submissions use `example.com` evidence URLs. The audit lists them. It does not delete or demote the records.

## License gates

These gates are blocking. This phase does not cross them.

| Source | Rule for this repo |
| --- | --- |
| IMDb noncommercial bulk files | Private discovery only. Do not commit raw files. Do not publish an IMDb-derived movie database. `npm run ingest:imdb` writes pending candidates, never public entries. |
| TMDB | Unused. Keep it off until a purpose and license are approved. Do not send TMDB content to a model under the standard restricted terms. |
| SSA `names.zip` | `npm run data:ssa` reads a local official file. A count under 5, or a missing name/sex/year, is `suppressed_or_absent` with a null count. The zip is not committed. |
| Wikidata, Duke AdViews, Internet Archive, brand archives | Not wired. Item-by-item rights review stays in front of any public clip, still, or transcript. |
| Public index | A convenience sample. It must not become the numerator or denominator of a population rate. |

Before IMDb or TMDB can feed an automated public catalog, document the permitted use or obtain rights. Attribution is not a license. Until then, publish only curated records from independently checked facts.

## Five-stage sequence

### Phase 1 — Correct and protect current discovery

Implemented in this change. Acceptance here:

- Actor named Steven playing Bob produces no fictional candidate.
- A director named Steve produces no candidate.
- `Stevenson` does not match.
- `short` and `video` are not commercial.
- `Dr. Steven Strange` and a multi-role `["Stevie", "Other Role"]` credit match the Steve-family role only.
- Two Steves in different works get two ids.
- Repeated episodes of one series character become one candidate.
- A rerun does not reset `accepted` or `rejected`.
- Published slugs and entry JSON stay as they were.
- `npm run test:ingest`, `npm run validate:content`, and `npm run build` are the checks.

### Phase 2 — Evidence and identity model

Implemented. SSA import and the study tables are phase 3. The extinction story is phase 5.

- Optional `SteveEntry` fields: `identityId`, `sourceIds`, `firstConfirmedAppearance`, `representationType`, `productionIds`, `imageRights`, `researchLinkIds`. Current entry JSON validates with none of them set.
- `db/migrations/0002_data_provenance.sql` adds `source_snapshot`, `work_identity`, `work_external_ref`, `character_identity`, `character_appearance`, `source_evidence`, and append-only `review_action`. `0001` is unchanged. Provider plus provider id is unique. Title text is not.
- Zod for those records lives in `src/lib/schema/identity-appearance.ts` and `src/lib/schema/source-evidence.ts`.
- `src/lib/data/identity-resolution.ts` proposes `new_identity`, `new_appearance`, `duplicate`, `out_of_scope`, or `needs_evidence`. The admin queue shows that suggestion. It is not saved, and it does not rewrite a published slug.
- `markCandidateReview` records an append-only review action. Inserts into `review_action` refuse a second write of the same id, and the table rejects updates and deletes.
- A saved `reviewDisposition` and `identityId` survive an ingest rerun.
- Tests cover a same-name collision, one actor in two Steve roles, series episodes versus a separate film credit, and unchanged published slugs.

### Phase 3 — SSA and the study foundation

Implemented. This phase does not calculate the Steve introduction rate and does not add the study page.

- `npm run data:ssa -- --file <names.zip> --release-date YYYY-MM-DD` reads an official zip or a directory of `yobYYYY.txt` files. The snapshot stores SHA-256, the release date, and sex. A count under 5, or a tracked name/sex/year with no row, is `suppressed_or_absent` and the count is null. Spellings stay separate. A year after 2025 can be kept as source data and is left out of the study window. No later year is estimated. The command prints a summary and writes only with `--write`, under `research/private/` by default.
- `db/migrations/0003_steve_studies.sql` adds `study_population`, `study_title_selection`, `study_character_credit`, `study_introduction`, `birth_name_count`, `study_metric`, and `study_exclusion_log`. `0001` and `0002` are unchanged. A birth count cannot be zero. A study credit cannot be marked public. A metric rate requires both a numerator and a denominator. The window columns are fixed at 1960 and 2025.
- Zod for those records, and for the frozen feasibility protocol, lives in `src/lib/schema/research.ts`. The protocol file is `research/studies/steve-extinction-feasibility.json`.
- `npm run data:feasibility -- --catalog <private.json>` draws 100 films and 50 TV series per decade from work metadata only. Genre strata use the largest-remainder method. A short decade is a census of the titles that exist, with the unfilled quota reported as a shortfall. The pilot writes completeness and name-matching counts. It does not write `new_steve_introductions_per_1000`.
- Research credits include non-Steves and the control names John, David, Michael, and Robert. They are not public candidates. Self credits, unnamed roles, and non-performers stay out of the eligible set. A TV debut is the earliest episode year, not the series start year. A missing debut is an exclusion, not an introduction. Repeated episodes of one performer and character are one credit and one introduction. The same credited name with a different performer is not merged.
- Outputs stay out of `content/`, `app/`, and `public/`. The public index cannot be the catalog. The synthetic completeness CSV in `tests/fixtures/study/` is a fixture for the parser, not a finding.

### Phase 4 — Reproducible analyses

Implemented. This phase calculates rates from a supplied catalog and an SSA file. It does not add the study page, and it does not treat the synthetic fixture as a national finding. The feasibility pilot still reports `primaryOutcomeCalculated: false`.

- `npm run data:study -- --catalog <private.json> --ssa <names.zip|yob dir|snapshot dir>` calculates the frozen outcomes. Pass `--release-date YYYY-MM-DD` unless `--ssa` already contains `birth-name-count.jsonl`. The command prints aggregate rates and writes only with `--write`, and only after QA passes. The default directory is `research/private/studies/<population-id>/analysis/`.
- `npm run data:qa -- --dir <analysis export>` re-reads that export and exits 1 when a check fails.
- The primary outcome, defined before a result is drawn, is `new_introductions_per_1000`: new fictional Steve-family introductions per 1,000 eligible new named character identities. Film and TV stay separate panels. A missing debut stays out of that denominator. A present denominator with no matches is a real zero.
- Secondary outcomes stay distinct: named-credit share per 1,000, work share per 100, and SSA birth-name share per 100,000 tabulated births. Birth shares and screen rates are not compared as percentage points. The public index is not a numerator or a denominator.
- Control names John, David, Michael, and Robert stay in the study. They do not become public Steve entries.
- Bootstrap resamples works or series, not credits. The lag scan reports every predeclared window from 0 to 50 years at 5-year steps and does not select one. A suppressed SSA cell stays null. If any Steve-family spelling is suppressed, the combined birth share is `partial_suppression` with a null rate.
- The same snapshot and seed rebuild the same ids, rates, and exclusions. Exports are the five aggregate files only. No commercial prevalence line is written.
- `db/migrations/0004_study_analysis.sql` adds metric columns, `birth_name_share`, and `study_lag_scan`. `0001` through `0003` are unchanged. A selected lag cannot be stored. The protocol file is `research/studies/steve-extinction.json`.

### Phase 5 — Data-linked story shell

Specified, not implemented. Do not start it in this change.

- Route such as `/studies/where-have-all-the-steves-gone`, fed only by validated exports.
- Charts come from those exports. No placeholder statistics and no pre-written extinction conclusion.
- Public-safe files only: study metadata, birth-name shares, screen rates, controls, story summary, and a QA report. Raw IMDb rows stay out of the build.

## Discovery limit that is still open

Full IMDb files are too large for the current in-memory title and name maps. Phase 3 does not add DuckDB or another disk-backed pass. Detection is now a pure function the script calls, so a later pass can replace the loader without rewriting the match rules. Do not run a full bulk ingest until that loader exists and a private snapshot is available. Raw IMDb files are not in git.

`title.basics.tsv`, `title.principals.tsv`, and `name.basics.tsv` remain required. `title.episode.tsv` is optional and groups episodes when present. Gzipped inputs are not read yet.

## Commands

| Command | Role |
| --- | --- |
| `npm run data:audit` | Rewrite `docs/evidence-audit.md` from `content/` JSON. Does not edit those JSON files. |
| `npm run data:ssa` | Read a local SSA `names.zip`. Dry-run unless `--write` is set. |
| `npm run data:feasibility` | Feasibility completeness and matching counts. Dry-run unless `--write` is set. |
| `npm run data:study` | Screen rates, birth shares, and the lag scan. Dry-run unless `--write` is set. Writes only when QA passes. |
| `npm run data:qa` | Re-read a study export and exit 1 when QA fails. |
| `npm run test:ingest` | `node:test` via `tsx` for the synthetic ingest and study fixtures. |
| `npm run ingest:imdb -- --dry-run` | Corrected discovery. Prints candidates and unresolved titles. Writes nothing. |
| `npm run validate:content` | Existing content validation. |
| `npm run build` | Existing production build. |

`npm run data:commercials` belongs to a later lane and is not a script yet.

## Still blocked

- No IMDb bulk snapshot is in this environment, so discovery and the feasibility pilot have been tested on synthetic fixtures only.
- No official SSA `names.zip` is in this environment. The importer has been tested on synthetic `yob` files and zip archives.
- No Postgres instance was used here, so `0002`, `0003`, and `0004` have not been applied to a live database. The suppression, review, and rate rules are covered in `node:test`.
- Every current evidence URL is still `example.com`. Replacing them is editorial work, not an ingest rewrite.
- Commercials need their own lane. Nothing in this sequence classifies an IMDb row as an ad, and the analysis does not invent an ad denominator.
- The rate commands have been tested on the synthetic catalog and SSA fixture. Those numbers are a parser check. They are not a national finding. A full IMDb bulk run is still blocked on a disk-backed loader and a private snapshot.
- `/studies/where-have-all-the-steves-gone` is not built.

## What happens next

Phase 5 is the story page. It should read only a QA-passed aggregate export: study metadata, birth-name shares, screen rates, the lag scan, and the QA report. No placeholder statistics and no pre-written extinction conclusion. A disk-backed IMDb pass still has to replace the in-memory loader before a full bulk run.
