# Product Definition

## Product Shape

As Steve on TV is an editorial media index. Users should be able to look up a known Steve, browse by category or mood, and fall into deeper trails through related entries and collections.

The product is closer to a curated cabinet than a database dashboard.

## Core User Journeys

### 1. Exact Lookup

The user knows roughly who or what they want.

Example:

- "Steve Urkel"
- "the Steve from Blue's Clues"
- "that Steven in a commercial"

The experience should return a clear result fast, then immediately offer adjacent rabbit holes.

### 2. Curious Browsing

The user arrives with no exact target and wants to wander.

They should be able to browse by:

- medium
- name variant
- character vs real person
- era
- tone or archetype
- editorial collections

### 3. Collection-Led Discovery

The user enters through an editorial package such as:

- iconic sitcom Steves
- Steves who were somehow in commercials before they were famous
- the most powerful Stevens in family drama history

Collections should feel authored, not auto-generated.

### 4. Contribution and Correction

The user notices a missing Steve, disputed inclusion, or factual issue.

They should have a lightweight way to submit:

- a candidate entry
- a correction
- missing supporting evidence

Submissions are suggestions, not direct publishing rights.

## Top-Level Information Architecture

- Home
- Browse
- Search results
- Steve entry page
- Collection page
- Submission page
- About / methodology
- Admin / moderation workspace

## Page Types

### Home

Purpose:

- explain the premise quickly
- showcase standout entries and collections
- make the site feel like a real institution

### Browse

Purpose:

- support non-linear discovery
- expose facets without feeling like enterprise filtering

### Search Results

Purpose:

- handle exact name matches, fuzzy intent, and related suggestions
- separate strong matches from "you may have meant"

### Steve Entry Page

This is the canonical profile page in the product sense.

It should include:

- title block
- hero metadata
- editorial blurb
- media context
- why this Steve matters
- related entries
- collection appearances
- provenance or notes when useful

### Collection Page

Purpose:

- package multiple entries under an editorial angle
- provide voice, ranking logic, and stronger recirculation

### Submission Page

Purpose:

- gather new candidates or corrections cleanly
- set expectations about moderation and evidence

### About / Methodology

Purpose:

- explain inclusion rules, naming scope, and editorial stance

## Feature Inventory

### Must-Have for MVP

- canonical Steve entry pages
- searchable index
- browse by core facets
- editorial collections
- internal relations between entries
- clean metadata display
- submission form for missing entries and corrections
- basic moderation workflow
- SEO-ready static pages

### Later

- public contributor profiles
- saved lists
- user voting
- comments
- recommendation feeds
- full CMS
- merch
- memberships

## Editorial Collections Concept

Collections are first-class product objects.

They should:

- present a thesis, not just a topic
- frame why a set of Steves belongs together
- create pathways to lesser-known entries
- use ranking language only when the editorial basis is clear

Examples:

- "The Patron Saints of Sitcom Steve"
- "Commercial Steves With Unreasonably Strong Aura"
- "Steven as the Respectable Older Brother Industrial Complex"

## Submission Flow Concept

MVP submission flow:

1. User opens the submission page.
2. User chooses new entry, correction, or dispute.
3. User provides the Steve name, title, media type, evidence, and note.
4. The system stores the submission for moderation.
5. Editors review, approve, reject, merge, or request clarification.

Submissions should help coverage without turning the product into an open wiki.

## Search Requirements

- prioritize exact Steve name matches
- support Steve / Stephen / Steven / Stevie variant matching
- search titles, performers, known aliases, and editorial keywords
- return fast, confidence-ordered results
- expose suggested filters without requiring a complex query builder
- use "related" and "you may be looking for" behavior when certainty is low

## Browse Requirements

- browsing should feel inviting, not administrative
- filters should reveal shape in the archive
- collections should be visible alongside faceted browse
- card density should support collecting behavior and serial clicking

Core browse dimensions:

- media type
- name variant
- character vs person
- decade or era
- archetype
- collection

## Steve Entry Page Requirements

- clear canonical display name
- inclusion context: character or on-screen person
- source media and year
- performer or self-as-self info where relevant
- short editorial summary
- "why this Steve is notable" framing
- related entries and collections
- ambiguity notes if the record is disputed or partial

## Success Criteria for MVP

- a first-time visitor understands the premise in under ten seconds
- the site launches with `250+` entries that feel intentionally curated
- exact lookup works for obvious queries
- browse produces real rabbit holes rather than dead ends
- collections materially improve discovery
- submissions can be reviewed without operational chaos
- the product feels designed and written, not assembled
