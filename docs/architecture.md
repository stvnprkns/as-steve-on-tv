# Architecture

## MVP Architecture Goal

Build a static-first, editorially controlled site that can launch quickly, scale cleanly to a few hundred entries, and stay understandable to a solo builder or small AI-assisted team.

The architecture should serve the product, not perform sophistication.

## Recommended App Structure

Recommended baseline:

- Next.js with the App Router
- repo-managed JSON content for public entries and collections
- Zod-backed schema files in `src/lib/schema/`
- content loaders and validation helpers in `src/lib/content/`
- static generation for public pages
- lightweight submission persistence later for moderation workflows
- build-time search index generation with a small local search layer

This gives the product:

- strong SEO
- low operational overhead
- deterministic content review
- a good path to later admin and moderation features

## Suggested Domain Model

Core public domain objects:

- `SteveEntry`
- `Collection`
- `TaxonomyData`

Operational objects:

- `Submission`
- `ModerationDecision`
- `AnalyticsEvent`

Keep the public domain model small and explicit. Add operational models only when the workflow requires them.

## Frontend, Backend, and Content Boundaries

### Frontend

Owns:

- layout and page rendering
- browse and search UI
- relation modules
- collection presentation
- analytics emission

### Content Layer

Owns:

- entry JSON files
- collection JSON files
- taxonomy definitions
- derived manifests and build-time indexes

### Backend or Server Actions

Owns:

- submission intake
- moderation state changes
- optional admin authentication
- storing audit metadata for editorial decisions

Do not blur public content and moderation workflow into one system too early.

## SEO and Page Generation Implications

- generate one static page per Steve entry
- generate one static page per collection
- generate browse pages only for stable editorial surfaces
- maintain stable slugs and canonical URLs
- include structured metadata, social cards, and page-specific titles
- avoid thin auto-pages for every imaginable tag

SEO should be a result of strong pages and good internal linking, not programmatic page spam.

## Search Architecture Guidance

For MVP, search should be light but intentional.

Recommended approach:

- build a normalized search index at build time from repo content
- include fields for display name, aliases, media title, performer, taxonomy terms, and editorial keywords
- use local search against a normalized document list for the seeded corpus
- add lightweight hosted or server-assisted search later only if scale or ranking truly demands it

Search ranking should eventually prioritize:

1. exact display-name match
2. exact alias match
3. title plus name relevance
4. editorial keyword support
5. fuzzy variant support

## Admin and Content Workflow Guidance

For public content:

- edit entries and collections in repo files
- review through pull requests or direct diff-based review
- validate schema in CI or pre-merge checks with `npm run validate:content`

For operational moderation:

- start with a tiny admin-only surface
- keep moderation state separate from published content
- convert accepted submissions into repo-backed canonical entries through an editorial pass

Do not start with a full CMS unless the repo-first model clearly breaks down.

The current scaffold uses local submission fixtures in `content/submissions/` for development only. Production submission storage can move to a lightweight backend once the form and moderation flow are ready to go live.

## Submission Moderation Flow

1. User submits a new entry, correction, or dispute.
2. System stores the submission in a small database table or hosted backend.
3. Moderator reviews evidence and assigns a status.
4. Accepted items are converted into or merged with repo content.
5. Rejected or disputed items retain notes for traceability.

This keeps public truth stable while still allowing contributions.

## Analytics Instrumentation Recommendations

Track only what helps product decisions.

Recommended MVP events:

- page view by page type
- search submitted
- search result clicked
- browse facet applied
- related entry clicked
- collection opened
- submission started
- submission completed

Important product questions:

- which pages create the deepest session trails
- which searches fail
- which collections drive downstream clicks
- which facets produce meaningful exploration

Avoid analytics bloat or surveillance-heavy tooling.

## What Should Be Hardcoded vs CMS-Driven vs Database-Driven in V1

### Hardcoded or Repo-Defined

- site navigation
- key homepage modules
- taxonomy vocabularies
- public entries
- public collections
- methodology copy

### Database-Driven Later

- live submission records
- moderation states
- admin review notes
- optional event storage if not handled by analytics tooling

### Not Needed in V1

- headless CMS for all public content
- generalized workflow engine
- user-generated public editing system
- recommendation service

## Non-Goals for MVP Architecture

- multi-tenant content infrastructure
- real-time collaboration
- overly flexible schema builders
- personalized feeds
- heavy search infrastructure
- broad media ingestion pipelines

The goal is not to prove technical ambition. The goal is to publish a sharp product with clean foundations.
