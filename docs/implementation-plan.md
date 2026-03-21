# Implementation Plan

## What Is Scaffolded Now

The repo now has a runnable baseline for the MVP:

- a root `app/` Next.js App Router scaffold
- a typed schema layer in `src/lib/schema/`
- validated JSON seed content in `content/`
- content-loading helpers in `src/lib/content/`
- a normalized search document builder in `src/lib/search/`
- a CI-ready validation script in `scripts/validate-content.ts`
- minimal route and component slices that render the seed corpus

This is enough to build real UI against actual records instead of placeholder arrays.

## What Is Ready To Build Next

### 1. Homepage polish

- replace the plain scaffold hero with a more intentional editorial landing surface
- add a stronger featured-collection module
- define the first permanent homepage shelves

### 2. Entry page depth

- improve card and detail hierarchy
- add better relation modules
- refine ambiguity treatment for disputed entries

### 3. Collection experience

- make collection pages feel more curated and less list-like
- add ranking language where a collection is explicitly ranked

### 4. Search UI

- add more useful query feedback
- add lightweight client-side refinement
- optionally add exact-match prioritization in the visible UI layer

### 5. Browse UI

- evolve medium-first browse into a cabinet-like multi-lane experience
- expose facets without turning the page into enterprise filtering

### 6. Submit and admin wiring

- replace fixture-only submit route with a real write path
- connect moderation statuses to a small persistent backend

## Recommended Order Of Implementation

1. install dependencies and confirm `npm run validate:content`
2. confirm `npm run build`
3. refine homepage and card primitives
4. refine Steve entry page layout and related modules
5. refine collection pages
6. improve browse and search experience
7. wire the real submission backend

This sequence keeps the product-facing surfaces ahead of operational tooling.

## First Real UI Slices

The first meaningful visual work should focus on:

- homepage hero and featured modules
- Steve card system
- Steve profile page hierarchy
- collection rails and collection page framing

Those slices will do the most to make the product feel collectible instead of merely typed.

## How To Use Schemas And Seed Data During Build

- add or edit content in `content/entries/`, `content/collections/`, and `content/submissions/`
- update schema only when a real user or editorial need demands it
- run `npm run validate:content` after any content or schema change
- use loader helpers rather than importing JSON files directly into routes
- use the search index builder as the single source for search document construction

## What To Avoid Overbuilding

- do not introduce a CMS yet
- do not add a database for public content
- do not build a complicated search service
- do not create more page types than the PRD calls for
- do not add analytics vendors before the event model itself is useful

## Path From Static Content To Dynamic Backend

The correct progression is:

1. repo-backed public content
2. real submission writes to a small persistence layer
3. admin moderation reads and updates that layer
4. accepted submissions are turned into canonical repo content through editorial review

That preserves the product's public source of truth while allowing operational workflows to grow up around it.
