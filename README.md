# As Steve on TV

As Steve on TV is a tightly scoped media index for Steve, Stephen, Steven, and Stevie characters and on-screen people across TV, movies, and commercials.

This is not a generic entertainment database. The narrowness is the point. The product should feel like a collectible cabinet, an internet museum, and a dead-serious pop culture almanac for one beautifully specific subject.

## Product Thesis

The internet is full of broad, forgettable databases. As Steve on TV works because it does the opposite.

By focusing on one absurdly specific editorial lane, the product can be:

- more memorable than a generic media catalog
- more tasteful than a wiki
- more searchable than a joke account
- more collectible than a standard index

Specificity is the moat. Editorial taste is the engine. Rabbit holes are the retention loop.

## Who This Is For

- people who love pop culture indexing, ranking, and discovery
- internet users who enjoy weirdly specific canonical sites
- editors, writers, and curators who care about taxonomy and tone
- future contributors and AI coding agents building a high-craft niche product

## Current MVP Scope

The MVP is a focused, editorially curated index with:

- `250+` Steve-related entries across TV, film, and commercials
- canonical Steve entry pages
- search and browse flows that reward rabbit holes
- editorial collections that create taste and framing
- a lightweight submission path for future additions
- a repo-first content system that stays legible to humans and AI agents

The MVP is not a broad people database, fandom wiki, social product, or ad-stuffed SEO farm.

## Guiding Principles

- Specificity is the moat.
- Delight beats generic utility.
- Editorial taste is part of the product, not decoration.
- Entries should feel collectible.
- Rabbit holes matter as much as lookup.
- The writing should stay straight-faced enough to become funny on its own.

## Getting Started

This repo now includes a runnable implementation baseline alongside the strategy docs.

1. Read [docs/prd.md](/Users/stephenperkins/Documents/steve-index/docs/prd.md).
2. Read [docs/implementation-plan.md](/Users/stephenperkins/Documents/steve-index/docs/implementation-plan.md).
3. Read [docs/content-model.md](/Users/stephenperkins/Documents/steve-index/docs/content-model.md).
4. Read [docs/agent-guide.md](/Users/stephenperkins/Documents/steve-index/docs/agent-guide.md).
5. Install dependencies with `npm install`.
6. Validate the content layer with `npm run validate:content`.
7. Start the app with `npm run dev`.

## Production Sync and Artifact Delivery

The production architecture is now split deliberately:

- Vercel serves the public site.
- Postgres stores canonical published entries, candidates, and ingest runs.
- Blob/object storage serves public archive artifacts.
- A daily external worker runs `npm run sync:imdb`.

### Required environment

- `DATABASE_URL`: canonical Postgres store
- `IMDB_BULK_DIR`: local directory containing prepared IMDb bulk files
- `ARTIFACT_BASE_URL`: public base URL for artifact reads
- `ARTIFACT_WRITE_TOKEN`: write token for artifact uploads
- `REVALIDATE_SECRET`: shared secret for internal cache invalidation routes
- `REVALIDATE_URL`: full URL to `/api/internal/revalidate-artifacts`
- `SITE_URL`: public site origin used as a fallback for internal callbacks
- `AUTO_PUBLISH_ACCEPTED=false`: leave accepted candidates editorial-first by default

Use [.env.example](/Users/stephenperkins/Documents/steve-index/.env.example) as the baseline.

### Operational commands

- `npm run ingest:imdb`: run the ingest stage only
- `npm run sync:imdb`: run ingest, publish accepted candidates if enabled, refresh artifacts, and trigger revalidation
- `npm run generate:artifacts`: regenerate public archive artifacts from the current published read model
- `npm run db:sync:fixtures`: seed fixture entries, collections, candidates, and ingest runs into Postgres

### GitHub Actions worker

The repo includes [.github/workflows/imdb-sync.yml](/Users/stephenperkins/Documents/steve-index/.github/workflows/imdb-sync.yml) as the default external worker. It expects a prepared IMDb dataset archive URL in `IMDB_BULK_ARCHIVE_URL`, downloads it on the runner, and then executes the sync pipeline on a daily cron or manual dispatch.

If you are implementing the app:

1. Treat the docs and schema layer as the current source of truth.
2. Prefer the static-first Next.js baseline already scaffolded here.
3. Keep canonical public content in validated repo JSON for v1.
4. Propose product, schema, or tone changes in docs before shipping them in code.

## How This Repo Is Organized

- [README.md](/Users/stephenperkins/Documents/steve-index/README.md): repo entrypoint and operating posture
- [docs/vision.md](/Users/stephenperkins/Documents/steve-index/docs/vision.md): product strategy and thesis
- [docs/product-definition.md](/Users/stephenperkins/Documents/steve-index/docs/product-definition.md): user journeys, IA, and feature definition
- [docs/prd.md](/Users/stephenperkins/Documents/steve-index/docs/prd.md): MVP execution spec
- [docs/content-model.md](/Users/stephenperkins/Documents/steve-index/docs/content-model.md): entities, schemas, taxonomy, moderation states
- [docs/editorial-system.md](/Users/stephenperkins/Documents/steve-index/docs/editorial-system.md): voice, tone, and writing rules
- [docs/design-principles.md](/Users/stephenperkins/Documents/steve-index/docs/design-principles.md): UI and UX north star
- [docs/architecture.md](/Users/stephenperkins/Documents/steve-index/docs/architecture.md): practical MVP architecture guidance
- [docs/roadmap.md](/Users/stephenperkins/Documents/steve-index/docs/roadmap.md): build sequencing and exit criteria
- [docs/implementation-plan.md](/Users/stephenperkins/Documents/steve-index/docs/implementation-plan.md): bridge from scaffold to shipping slices
- [docs/agent-guide.md](/Users/stephenperkins/Documents/steve-index/docs/agent-guide.md): how agents and contributors should operate
- [docs/skills.md](/Users/stephenperkins/Documents/steve-index/docs/skills.md): capability map and review lenses
- [docs/mvp-scope.md](/Users/stephenperkins/Documents/steve-index/docs/mvp-scope.md): ruthless scope control
- [docs/repo-map.md](/Users/stephenperkins/Documents/steve-index/docs/repo-map.md): predicted codebase shape
- `app/`, `src/lib/schema/`, `src/lib/content/`, `src/lib/search/`, and `content/`: runnable MVP implementation layer

There is also a legacy static prototype in `index.html`, `app.js`, `style.css`, and `steves.json`. It is useful as historical context only. It is not the active app surface, not the content model, and not the architectural direction.

## How To Use The Docs In This Repo

- Start with vision before architecture.
- Check MVP scope before adding features.
- Check content model before inventing fields or relations.
- Run `npm run validate:content` before trusting new content or schema changes.
- Check editorial and design principles before writing copy or UI.
- Check the agent guide before making implementation decisions.

When docs disagree, resolve the disagreement in docs first. Do not let code become the accidental product spec.

## Build Philosophy

Build this like a niche classic, not a startup template.

- Favor strong defaults over flexible abstractions.
- Favor authored pages over auto-generated sludge.
- Favor clean retrieval and discovery over feature bloat.
- Favor structures that a solo builder and AI agents can understand.
- Favor shipping a sharp premise over prematurely broadening the market.

## How To Work On This Product Without Ruining It

- Do not broaden the premise beyond Steve / Stephen / Steven / Stevie in TV, movies, and commercials.
- Do not make the product feel like IMDb-lite, a fandom wiki, or a CRUD dashboard.
- Do not replace editorial judgment with bulk metadata just because automation makes it easy.
- Do not add community features, monetization systems, or personalization before the index itself feels inevitable.
- Do not introduce generic UI kits or SaaS patterns that flatten the product's character.
- Do not ship collections that are only tag pages with nicer names.
- Do not confuse more content with better content.

The product should feel exacting, collectible, and delightfully overcommitted to its premise.
