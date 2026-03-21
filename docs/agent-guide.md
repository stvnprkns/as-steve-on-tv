# Agent Guide

## Purpose

This document is the operating manual for Codex, Claude Code, Cursor, and human contributors working in this repo.

The goal is simple: build As Steve on TV without sanding off the point of the product.

## Read This First

Before making changes, read in this order:

1. [vision.md](/Users/stephenperkins/Documents/steve-index/docs/vision.md)
2. [mvp-scope.md](/Users/stephenperkins/Documents/steve-index/docs/mvp-scope.md)
3. [prd.md](/Users/stephenperkins/Documents/steve-index/docs/prd.md)
4. [implementation-plan.md](/Users/stephenperkins/Documents/steve-index/docs/implementation-plan.md)
5. [content-model.md](/Users/stephenperkins/Documents/steve-index/docs/content-model.md)
6. [editorial-system.md](/Users/stephenperkins/Documents/steve-index/docs/editorial-system.md)
7. [design-principles.md](/Users/stephenperkins/Documents/steve-index/docs/design-principles.md)
8. [architecture.md](/Users/stephenperkins/Documents/steve-index/docs/architecture.md)

Do not start implementation from vibes.

## Non-Negotiable Product Constraints

- The product name is always `As Steve on TV`.
- Scope is Steve / Stephen / Steven / Stevie across TV, movies, and commercials.
- The product is editorial and collectible first, database-like second.
- Canonical public content lives in repo files for v1.
- The recommended architecture is static-first Next.js.
- Collections are authored editorial objects, not prettified tag pages.
- Humor must come from conviction and specificity, not from mugging.

If your proposed change weakens any of these points, stop and revise it.

## Coding Philosophy

- Keep the system legible.
- Prefer strong defaults over configurable abstractions.
- Prefer simple domain models over framework cleverness.
- Build for a solo builder and AI-assisted workflow.
- Make the code serve the product shape already defined in docs.

The project does not need proof-of-concept architecture theatre.

## Documentation-First Workflow

For any meaningful product, schema, IA, tone, or UX change:

1. identify which doc is the source of truth
2. update the doc or confirm it already supports the change
3. run `npm run validate:content` if the change touches content or schemas
4. implement in code
5. verify the implementation still matches the doc

Do not let code become the only place where decisions live.

## How To Avoid Generic Implementation

- Do not reach for default SaaS patterns.
- Do not use content-platform abstractions when a sharper product-specific structure will do.
- Do not introduce fields, filters, or pages just because they are common in media sites.
- Do not fill empty states or collection pages with thin auto-generated copy.
- Do not flatten visual hierarchy into utility-grid sameness.

Every implementation should ask:

- does this make the product feel more collectible
- does this make rabbit holes better
- does this preserve the editorial point of view

## How To Propose Schema Changes

Before adding or changing schema:

- check [content-model.md](/Users/stephenperkins/Documents/steve-index/docs/content-model.md)
- check the actual Zod layer in `src/lib/schema/`
- explain why the new field or relation improves a real user journey
- note whether it affects search, browse, collections, or editorial workflow
- prefer the smallest change that solves the problem

Bad schema changes:

- broad metadata expansion with no clear UI use
- fields added for flexibility alone
- parallel systems for the same concept

## How To Propose UI Changes

Before changing UI structure:

- check [prd.md](/Users/stephenperkins/Documents/steve-index/docs/prd.md)
- check [design-principles.md](/Users/stephenperkins/Documents/steve-index/docs/design-principles.md)
- explain whether the change improves lookup, browse, collections, or rabbit-hole behavior
- avoid introducing chrome or controls that make the product feel administrative

## How To Propose Content Changes

Before changing editorial patterns:

- check [editorial-system.md](/Users/stephenperkins/Documents/steve-index/docs/editorial-system.md)
- preserve straight-faced absurdity
- improve specificity, not volume
- do not auto-generate tone

## Quality Bar Expectations

A change is high-quality when it is:

- consistent with the product thesis
- simple enough to maintain
- specific enough to feel intentional
- well-documented if it changes product behavior
- tested at the level appropriate to its risk

The bar is not works. The bar is works without making the product more generic.

## Definition Of Done For Product Work

A feature is done when:

- it matches the scope and product definition
- docs and implementation agree
- the UI feels in character
- the content model still makes sense
- the behavior is tested or verified
- no obvious generic-product drift was introduced

## Warnings

### Overbuilding

Do not build systems for scale the product has not earned.

### Scope Drift

Do not broaden the product into a general name index, broad entertainment database, or social platform.

### Tone Drift

Do not let copy become either stiff and joyless or winkingly self-aware.

### Accidental Platformization

Do not convert the repo into a generic CMS-driven media engine just because the framework makes it possible.

## Preferred Default Decisions

When the docs do not specify a detail, prefer:

- repo-first content
- JSON-first public content for v1
- static generation
- explicit relations
- authored collections
- small, reviewable schema changes
- search that favors clarity over sophistication
- UI that feels like an archive, not an app shell

If a decision would materially change product identity, update the docs first.
