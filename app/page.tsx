import Link from "next/link";

import { CollectionCard } from "@/src/components/cards/collection-card";
import { EntryCard } from "@/src/components/cards/entry-card";
import { SiteShell } from "@/src/components/layout/site-shell";
import { SearchBar } from "@/src/components/search/search-bar";
import { SectionHeader } from "@/src/components/ui/section-header";
import { buildMetadata } from "@/src/lib/seo/metadata";
import { getAllCollections, getAllEntries, getTaxonomy } from "@/src/lib/content";
import {
  getBrowseCues,
  getFeaturedEntries,
  getHomepageCollections,
  getPublishedEntries,
  getRecentEntries,
  getSpotlightEntry
} from "@/src/lib/content/selectors";

export const metadata = buildMetadata({
  title: "As Steve on TV",
  description:
    "A straight-faced editorial index of Steve, Stephen, Steven, and Stevie across TV, movies, and commercials."
});

export default async function HomePage() {
  const [entries, collections, taxonomy] = await Promise.all([getAllEntries(), getAllCollections(), getTaxonomy()]);
  const spotlightEntry = getSpotlightEntry(entries);
  const featuredEntries = getFeaturedEntries(entries);
  const recentEntries = getRecentEntries(entries);
  const browseCueGroups = getBrowseCues(entries, taxonomy);
  const homepageCollections = getHomepageCollections(collections);
  const publishedEntries = getPublishedEntries(entries);

  return (
    <SiteShell
      eyebrow="The internet's Steve index"
      title="A serious archive for Steve on screen."
      description="TV, movies, and commercials. No broader premise. No database sludge. Just a highly specific cultural filing system that takes the assignment seriously."
    >
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="home-hero__lede">
            As Steve on TV catalogs Steve, Stephen, Steven, and Stevie characters and on-screen people across media with the conviction usually reserved for institutions.
          </p>
          <div className="home-hero__actions">
            <SearchBar buttonLabel="Search the file" placeholder="Steve Urkel, Blue's Clues, Steven..." />
            <div className="home-hero__links">
              <Link className="text-link" href="/browse">
                Browse the cabinet
              </Link>
              <Link className="text-link" href="/submit">
                Missing a Steve?
              </Link>
            </div>
          </div>
        </div>
        <aside className="home-hero__stats">
          <p className="kicker">Current filing</p>
          <ul className="stat-list">
            <li>
              <strong>{publishedEntries.length}</strong>
              <span>published entries</span>
            </li>
            <li>
              <strong>{homepageCollections.length}</strong>
              <span>editorial shelves featured here</span>
            </li>
            <li>
              <strong>3</strong>
              <span>media lanes in scope</span>
            </li>
          </ul>
        </aside>
      </section>

      {spotlightEntry ? (
        <section className="stack">
          <SectionHeader
            eyebrow="Spotlight"
            title="One Steve to start with"
            description="The archive should feel navigable fast. This is the cleanest first card in the cabinet."
          />
          <EntryCard entry={spotlightEntry} variant="featured" />
        </section>
      ) : null}

      <section className="stack">
        <SectionHeader
          eyebrow="Featured Steves"
          title="Canonical entries worth opening first"
          description="A starter shelf of Steves that explain the range, tone, and usefulness of the archive."
        />
        <div className="grid grid--two">
          {featuredEntries.map((entry) => (
            <EntryCard entry={entry} key={entry.id} />
          ))}
        </div>
      </section>

      <section className="stack">
        <SectionHeader
          eyebrow="Recent additions"
          title="Freshly filed"
          description="Newer cards in the cabinet, sorted by when they entered the archive."
        />
        <div className="grid grid--two">
          {recentEntries.map((entry) => (
            <EntryCard entry={entry} key={entry.id} variant="compact" />
          ))}
        </div>
      </section>

      <section className="stack">
        <SectionHeader
          eyebrow="Browse cues"
          title="Open a drawer"
          description="Small routes into the archive by medium, name shape, and era."
        />
        <div className="browse-cue-grid">
          {browseCueGroups.map((group) => (
            <article className="browse-cue-card" key={group.title}>
              <h3>{group.title}</h3>
              <ul className="browse-cue-card__list">
                {group.items.map((item) => (
                  <li key={`${group.title}-${item.label}`}>
                    <Link href={item.href}>
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="stack">
        <SectionHeader
          eyebrow="Editorial shelves"
          title="Collections that make the archive feel deeper than it is"
          description="Authored groupings, not dressed-up tag pages."
        />
        <div className="grid grid--three">
          {homepageCollections.map((collection) => (
            <CollectionCard collection={collection} key={collection.id} />
          ))}
        </div>
      </section>

      <section className="submission-cta">
        <p className="submission-cta__eyebrow">Archive maintenance</p>
        <h2>Missing a Steve, Stephen, Steven, or Stevie?</h2>
        <p>
          The filing system is intentionally narrow, not finished. If something obvious is absent, the archive should hear about it.
        </p>
        <Link className="button-link" href="/submit">
          Submit a missing Steve
        </Link>
      </section>
    </SiteShell>
  );
}
