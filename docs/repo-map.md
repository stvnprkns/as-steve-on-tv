# Repo Map

## Purpose

This document defines the expected structure of the repo as As Steve on TV grows from documentation into a real product.

The goal is not perfect permanence. The goal is to keep the codebase understandable while the product evolves.

## Expected Folders

```text
/
  README.md
  docs/
  app/
  content/
    entries/
    collections/
    submissions/
    taxonomies/
  src/
    components/
    lib/
      schema/
      content/
      search/
      analytics/
      seo/
      utils/
  public/
  scripts/
  tests/
```

## Where Content Lives

Public canonical content should live in:

- `content/entries/`
- `content/collections/`
- `content/taxonomies/`

Local-development submission fixtures live in:

- `content/submissions/`

Use repo-managed files for all public Steve entries and collections in v1.

## Where Schemas Live

Recommended location:

- `src/lib/schema/`

This layer should hold:

- Zod schemas and inferred TypeScript types
- shared field primitives
- taxonomy enums and controlled vocabularies
- submission, collection, and entry record definitions

Keep schema logic close to content ingestion, not scattered through route files.

## Where Content Loaders Live

Recommended location:

- `src/lib/content/`

This layer should hold:

- JSON readers
- validation wrappers
- duplicate and cross-reference checks
- slug lookup helpers

## Where UI Lives

Recommended locations:

- `app/` for routes and page composition
- `src/components/` for reusable UI building blocks
- `app/globals.css` for global styling foundations

Favor product-specific component naming over generic dashboard language.

## Where Search Logic Lives

Recommended location:

- `src/lib/search/`

This layer should own:

- normalized search document creation
- text normalization
- future ranking helpers
- search result shaping

Do not bury search rules inside random UI components.

## Where Admin and Moderation Tools Live

Recommended location:

- `app/admin/`

This area should cover:

- submission review screens
- moderation actions
- editorial status views

Keep operational tooling clearly separated from the public product.

## Where Collections Live

Collections are content first, not UI-only constructs.

Store:

- collection content in `content/collections/`
- collection rendering logic in `app/` and `src/components/`
- collection-specific helpers in `src/lib/content/` if needed

## Where Docs Live

All strategy, product, editorial, architecture, and workflow docs should stay in:

- `docs/`

If a major product decision is only reflected in code comments, the repo is drifting.

## How To Keep The Repo Understandable

- keep public content separate from operational data
- keep schemas close to loaders
- keep search logic centralized
- keep route files thin
- avoid inventing multiple sources of truth
- add new top-level folders reluctantly

A good repo for this product should feel like the product itself: organized, specific, and easy to navigate once you know the framing.
