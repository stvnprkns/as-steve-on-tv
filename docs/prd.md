# PRD

## Product Summary

As Steve on TV is a tightly scoped editorial index for Steve, Stephen, Steven, and Stevie characters and on-screen people across television, movies, and commercials.

It solves a very internet-shaped problem: broad databases are good at storing facts, but bad at turning weird cultural specificity into a memorable product. This product wins by treating one narrow lane with enough seriousness that it becomes both useful and delightful.

People will use it because:

- it is immediately legible
- it rewards both lookup and wandering
- it turns a joke-sized premise into a trustworthy archive
- it offers the satisfaction of ranking, collecting, and connecting Steves across media

The specificity matters because it creates identity, focus, and editorial pressure. Without the narrow lane, the product collapses into generic entertainment sludge.

## Goals

### Product Goals

- launch a convincing Steve index with real editorial character
- make exact lookup, browsing, and rabbit-hole discovery all work in MVP
- establish a content system that supports growth without platform bloat

### User Goals

- find a known Steve quickly
- discover adjacent Steves through collections and relations
- understand why a Steve belongs in the archive
- submit missing entries or corrections without dealing with a wiki

### Business and Strategic Goals

- create a memorable niche property with strong shareability
- build a repo-first foundation a solo founder and AI agents can extend
- prove the concept before adding monetization or broader community systems

## Non-Goals

- becoming a general entertainment database
- supporting every first-name index
- building user accounts, comments, or social loops in MVP
- launching a CMS-heavy editorial stack before the archive earns it
- shipping broad SEO page farms or auto-generated tag sludge

## Target Users

### Curious Visitors

People who arrive because the premise is strange enough to click.

### Nostalgia Browsers

Users who want to revisit Steves from childhood, reruns, cable memory, or long-tail streaming.

### Contributors

People who notice missing entries, factual gaps, or disputed inclusions and want a lightweight correction path.

### Ranking and List People

Users who enjoy taxonomy, hierarchy, taste, and the pleasure of seeing a canon argued into existence.

## Core User Journeys

### Searching for a Known Steve

1. User lands on search or uses site navigation.
2. User searches by Steve name, title of work, performer, or obvious alias.
3. System returns exact or highly relevant results first.
4. User opens the Steve page and gets immediate orientation: who this Steve is, where they appear, why they matter.
5. Page offers related entries and collections for the next click.

Success condition:

- the obvious Steve is easy to find
- the result page does not feel like a generic database dump

### Browsing by Category, Era, or Medium

1. User opens browse with no exact target.
2. User scans by medium, era, name variant, or collection.
3. Cards reveal enough shape to invite serial clicking.
4. User moves from one lane into another without dead ends.

Success condition:

- browsing feels exploratory rather than administrative

### Reading a Steve Profile

1. User opens a Steve profile page.
2. Page immediately communicates medium, work, performer, era, and Steve type.
3. User reads synopsis, editorial blurb, and why-it-matters framing.
4. User sees tags, related entries, and collection appearances.

Success condition:

- the page feels authored, collectible, and link-worthy

### Discovering Related Steves

1. User lands on an entry or collection.
2. System exposes explicitly related entries plus collection context.
3. User continues deeper into another Steve page or editorial grouping.

Success condition:

- related content feels intentional, not random

### Submitting a Missing Steve

1. User opens submit page.
2. User enters the proposed Steve, medium, work, evidence, and notes.
3. System stores the submission with a clear moderation state.
4. User understands that submission is a suggestion, not publication.

Success condition:

- submission flow is light, clear, and credible

### Admin Reviewing and Publishing a Submission

1. Admin opens moderation view.
2. Admin reviews submission type, evidence, notes, and linked record state.
3. Admin marks the record accepted, rejected, merged, or needing more evidence.
4. Accepted records are converted into canonical repo-backed content through editorial review.

Success condition:

- moderation workflow is workable without a large backend

## Functional Requirements

### Homepage

- explain the premise in under ten seconds
- feature a small set of real Steve entries
- feature collections as first-class objects
- feel like the archive has shape, not just inventory

### Search

- support exact and near-exact name lookup
- match across display name, canonical name, aliases, title of work, performer, and editorial keywords
- surface typed search results for entries and collections

### Browse Pages

- expose medium-led browse first
- keep taxonomy visible and understandable
- allow the user to move from browse into entry and collection pages cleanly

### Steve Profile Pages

- render core metadata
- render synopsis, editorial blurb, and why-it-matters copy
- render related entries and collection appearances
- display status and confidence for ambiguous cases

### Collections Pages

- render title, dek, thesis, and entry list
- preserve collection identity as editorial object, not computed taxonomy page

### Submit Flow

- provide schema-backed inputs for future live wiring
- clarify that the MVP scaffold is not yet a persistent public workflow
- use the same vocabulary as the moderation model

### Admin and Moderation

- show typed submission fixtures and statuses
- make the future review path obvious
- avoid pretending a full workflow engine exists when it does not

### SEO and Metadata

- provide page-level metadata for home, browse, search, entry, collection, submit, and admin routes
- keep slugs stable and human-readable
- avoid thin derivative pages

### Analytics

- define event names for page views, search, browse, related clicks, collection opens, and submissions
- do not wire heavy analytics yet

## Content Requirements

### Minimum Fields for Steve Entries

- identifiers and slug
- display and canonical naming
- variant, medium, entry type
- work title, performer or person, years
- synopsis
- editorial blurb
- why-it-matters
- steve energy
- archetypes, era, tones, tags
- related entry ids and collection ids
- status, confidence, timestamps

### Minimum Fields for Collections

- identifiers and slug
- title and dek
- thesis
- entry ids
- collection type
- tags
- status
- SEO title and description
- timestamps

### Editorial Quality Bar

- no filler records
- no metadata-only copy
- no wink-heavy joke writing
- every entry should make a specific case for its inclusion

### Image and Media Handling Guidance

- images are optional in MVP
- image metadata may be stored, but asset ingestion is not part of this step
- do not scrape or bulk import media
- treat legal caution and editorial restraint as defaults

## MVP Success Criteria

### Launch Quality Bar

- the app boots cleanly as a Next.js baseline
- the seeded content validates through Zod
- homepage, browse, search, entry, collection, submit, and admin routes render real data
- the product does not feel generic even in scaffold form

### Measurable Usage Signals

- users can complete exact lookup successfully
- search index produces useful result sets
- seeded collections drive downstream entry clicks
- content validation and build pass without backend dependencies

### Qualitative Signals

- the repo feels implementation-ready to another strong engineer or agent
- the seed entries feel like the start of a real publication
- the archive already has a point of view

## Constraints

### Legal and Asset Caution

- do not introduce media ingestion pipelines
- keep image handling optional and metadata-first

### Editorial Consistency

- preserve the straight-faced editorial voice
- protect the product from tone drift and taxonomy sprawl

### Scope Control

- stay inside Steve / Stephen / Steven / Stevie
- stay inside TV, movies, and commercials
- do not introduce broad platform features

### Solo-Builder Practicality

- prefer file-backed public content
- prefer small utilities over generalized systems
- keep the stack dependency-light

## Open Questions

- when the public submission flow goes live, should moderation state live in a tiny hosted database or a serverless persistence layer tied to the app host
- when the editorial surface expands, is JSON still enough or does selected entry and collection longform need MDX
- what is the first real homepage editorial module after the scaffold: featured collection, recent additions, or canonical Steves shelf

