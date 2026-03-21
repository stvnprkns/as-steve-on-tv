# Content Model

## Source of Truth

For MVP, canonical public content should live in repo content files.

Recommended v1 format:

- one JSON file per Steve entry
- one JSON file per collection
- one JSON file per local-development submission fixture
- typed schema validation in code with Zod
- generated search documents at build time

JSON is the right v1 trade because it keeps loading, validation, diffs, and AI-assisted editing extremely legible. Richer MDX authoring can come later if the editorial surface genuinely starts to outgrow structured fields.

## Core Entities

- `SteveEntry`: a canonical indexed Steve item
- `Collection`: an editorial grouping of Steve entries
- `Submission`: a proposed new entry, correction, or dispute
- `TaxonomyData`: the controlled vocabularies that drive browse, validation, and moderation

## Steve Entry Definition

A Steve entry represents one in-scope Steve, Stephen, Steven, or Stevie appearance.

It can describe:

- a fictional character
- a real on-screen person appearing as themselves or in a credited role
- a recurring commercial persona

It does not describe:

- off-screen crew with no on-screen inclusion reason
- generic people databases
- non-Steve adjacent names

## Steve Entry Schema

Recommended JSON shape:

```json
{
  "id": "steve-urkel-family-matters",
  "slug": "steve-urkel-family-matters",
  "displayName": "Steve Urkel",
  "canonicalName": "Steve Urkel",
  "nameVariant": "steve",
  "entryType": "character",
  "medium": "tv",
  "titleOfWork": "Family Matters",
  "franchise": "TGIF",
  "yearStart": 1989,
  "yearEnd": 1998,
  "actorOrPerson": "Jaleel White",
  "synopsis": "The suspenders-first chaos engine who turned a family sitcom into a Steve event.",
  "editorialBlurb": "Steve Urkel is not merely a sitcom Steve. He is the benchmark case for what happens when a specific kind of television nuisance becomes a cultural weather system.",
  "whyItMatters": "He changed the meaning of Steve on television and remains one of the clearest examples of a character overwhelming the format built around him.",
  "steveEnergy": "mythic",
  "archetypes": ["chaos-engine", "sitcom-neighbor", "nostalgia-core"],
  "era": "1990s",
  "tones": ["chaotic", "iconic", "absurd"],
  "tags": ["sitcom", "glasses", "catchphrase", "tgif"],
  "searchAliases": ["did i do that"],
  "relatedEntryIds": ["steve-holt-arrested-development"],
  "collectionIds": ["patron-saints-of-sitcom-steve"],
  "status": "published",
  "confidence": "high",
  "sourceNotes": ["Recurring and later central character across the full run of Family Matters."],
  "createdAt": "2026-03-15T12:00:00Z",
  "updatedAt": "2026-03-15T12:00:00Z"
}
```

Longform editorial copy should stay in structured string fields for v1. If future entry pages require richer compositions, move selectively to MDX only after the JSON-first workflow begins to feel cramped.

## Collection Schema

```json
{
  "id": "patron-saints-of-sitcom-steve",
  "slug": "patron-saints-of-sitcom-steve",
  "title": "The Patron Saints of Sitcom Steve",
  "dek": "The Steves who defined television's broadest, loudest, and most durable comic Steve signals.",
  "thesis": "Sitcom Steve is not one thing, but it usually arrives with unusually clear pressure.",
  "entryIds": ["steve-urkel-family-matters", "steve-holt-arrested-development", "steve-harrington-stranger-things"],
  "collectionType": "ranked_editorial",
  "tags": ["sitcom", "television", "canon"],
  "status": "published",
  "seoTitle": "The Patron Saints of Sitcom Steve | As Steve on TV",
  "seoDescription": "A ranked editorial collection of the Steves who most clearly defined the sitcom branch of the archive.",
  "createdAt": "2026-03-15T12:20:00Z",
  "updatedAt": "2026-03-15T12:20:00Z"
}
```

Collections should keep their argument in explicit fields such as `dek`, `thesis`, `entryIds`, and SEO metadata rather than introducing authoring complexity too early.

## Submission Schema

Operational submissions should eventually live in a database or service layer, not in repo content files.

For the current scaffold, `content/submissions/` contains local-development fixtures so the moderation schema, admin route, and validation flow can be exercised without standing up backend infrastructure.

Recommended fields:

```json
{
  "id": "submission-steve-brule-correction",
  "submissionType": "new_entry",
  "proposedName": "Dr. Steve Brule",
  "proposedVariant": "steve",
  "proposedMedium": "tv",
  "titleOfWork": "Check It Out! with Dr. Steve Brule",
  "evidenceUrl": "https://example.com/evidence/dr-steve-brule",
  "notes": "Feels like a major omission for the stranger branch of television Steve.",
  "submitterName": "Marcus T.",
  "submitterEmail": "marcus@example.com",
  "status": "accepted",
  "reviewNotes": "Strong candidate. Add as a TV persona entry once seed batch two is assembled.",
  "linkedEntryId": null,
  "createdAt": "2026-03-15T12:31:00Z",
  "updatedAt": "2026-03-15T12:40:00Z"
}
```

Supported submission types:

- `new_entry`
- `correction`
- `dispute`

## Tags and Taxonomy

Taxonomy should stay controlled. Do not let tags become a junk drawer.

Current taxonomy groups:

- `nameVariant`: steve, stephen, steven, stevie
- `medium`: tv, film, commercial
- `entryType`: character, person, persona
- `contentStatus`: draft, review, published, withheld, deprecated
- `moderationStatus`: pending_review, accepted, rejected, merged, needs_more_evidence
- `collectionType`: editorial, ranked_editorial, archetype, seasonal, starter_pack
- `steveEnergy`: steady, chaotic, magnetic, weaponized, mythic
- `archetypeTags`: controlled editorial archetypes
- `eraTags`: decade buckets
- `toneTags`: controlled tonal descriptors

Rules:

- use controlled lists for facets that drive browse
- allow a smaller reviewed free-tag surface only when it materially helps discovery
- do not create taxonomies that only exist because a database can hold them

## Relations Model

Steve entries should support explicit relations.

Current v1 relation surfaces:

- `relatedEntryIds`
- `collectionIds`

That is enough to support rabbit holes without building an enterprise graph model. If relation semantics need to grow later, add a small typed relation object instead of parallel ad hoc fields.

## Name Variant Rules

- `Steve`, `Stephen`, `Steven`, and `Stevie` are in scope.
- Canonical `displayName` should reflect the on-screen or commonly recognized name.
- `nameVariant` should store the normalized family bucket used for browse.
- Nicknames, aliases, and alternate spellings belong in `searchAliases`.
- Non-Steve names are out of scope unless the actual indexed appearance is Steve-derived.

Examples:

- `Steve Urkel` -> in scope
- `Steven Hyde` -> in scope
- `Stevie Budd` -> in scope
- `Stephanie` -> out of scope unless editorial policy changes later

## Media Inclusion Rules

Included:

- scripted television
- unscripted television if the on-screen person appearance is meaningfully indexable
- films
- commercials and branded spots with a distinct Steve presence

Excluded for MVP:

- podcasts
- books
- stage productions
- games
- off-screen industry databases
- broad internet video unless treated as a commercial and clearly in lane

## Moderation States

### Public Content Status

- `draft`
- `review`
- `published`
- `withheld`
- `deprecated`

### Submission Status

- `pending_review`
- `accepted`
- `rejected`
- `merged`
- `needs_more_evidence`

## Ambiguity and Disputed Entry Handling

Some entries will be messy. The system should handle that directly.

Use `confidence: "disputed"` or `status: "review"` when:

- naming qualification is unclear
- the appearance is remembered but not fully supported
- the person is arguably out of lane
- the Steve status depends on looser editorial interpretation

Rules:

- keep a public note when the ambiguity affects trust
- prefer inclusion with context over false certainty
- do not silently stretch the rules to make a fun entry fit

## Example Steve Entry

```json
{
  "id": "steve-holt-arrested-development",
  "slug": "steve-holt-arrested-development",
  "displayName": "Steve Holt",
  "canonicalName": "Steve Holt",
  "nameVariant": "steve",
  "entryType": "character",
  "medium": "tv",
  "titleOfWork": "Arrested Development",
  "yearStart": 2003,
  "actorOrPerson": "Justin Grant Wade",
  "synopsis": "An all-caps recurring Steve whose main instrument is immediate legibility.",
  "editorialBlurb": "Steve Holt arrives fully branded and immediately useful. The name does half the work before the performance even starts.",
  "whyItMatters": "He is a perfect recurring-character Steve: compact, loud, and impossible to confuse with anyone else.",
  "steveEnergy": "chaotic",
  "archetypes": ["recurring-chaos", "chaos-engine"],
  "era": "2000s",
  "tones": ["absurd", "chaotic", "iconic"],
  "tags": ["recurring-character", "catchphrase", "sitcom"],
  "searchAliases": ["steve holt!"],
  "relatedEntryIds": ["steve-urkel-family-matters"],
  "collectionIds": ["patron-saints-of-sitcom-steve"],
  "status": "published",
  "confidence": "high",
  "sourceNotes": ["Recurring joke-character with enduring fan recognition."],
  "createdAt": "2026-03-15T12:08:00Z",
  "updatedAt": "2026-03-15T12:08:00Z"
}
```

## Example Collection

```json
{
  "id": "commercial-steves-with-unreasonably-strong-aura",
  "slug": "commercial-steves-with-unreasonably-strong-aura",
  "title": "Commercial Steves With Unreasonably Strong Aura",
  "dek": "A short-format lane for Steves and Stevens who somehow carry far more pressure than the ad slot requires.",
  "thesis": "Commercials are a serious lane of Steve history because concentrated runtime can make the impression sharper, not thinner.",
  "entryIds": ["steven-seagal-lightning-bolt-commercial", "stevie-nicks-fajita-roundup-commercial"],
  "collectionType": "editorial",
  "tags": ["commercial", "advertising", "aura"],
  "status": "published",
  "seoTitle": "Commercial Steves With Unreasonably Strong Aura | As Steve on TV",
  "seoDescription": "An editorial collection for the commercial lane, including strong and disputed Steve-derived ad appearances.",
  "createdAt": "2026-03-15T12:23:00Z",
  "updatedAt": "2026-03-15T12:23:00Z"
}
```
