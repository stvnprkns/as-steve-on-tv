import { CollageSurface } from "@/src/components/collage/collage-surface";
import { getAllEntries, getPublicCollageCutouts } from "@/src/lib/content";
import { layoutCutouts } from "@/src/lib/cutout/layout";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "As Steve on TV",
  description: "There are a lot of Steves on TV. Find this one."
});

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const find = Array.isArray(params.find) ? params.find[0] : params.find;
  const [cutouts, entries] = await Promise.all([getPublicCollageCutouts(), getAllEntries()]);
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const layout = layoutCutouts(cutouts);
  const figures = cutouts.map((cutout) => {
    const entry = cutout.entryId ? entriesById.get(cutout.entryId) : undefined;
    return {
      id: cutout.id,
      displayName: cutout.displayName,
      titleOfWork: entry?.titleOfWork ?? cutout.source.title,
      yearStart: entry?.yearStart,
      actorOrPerson: entry?.actorOrPerson,
      entrySlug: entry?.slug,
      evidenceUrl: cutout.source.url ?? entry?.evidenceLinks[0]?.url,
      src: `/api/collage/${cutout.id}`
    };
  });

  return <CollageSurface figures={figures} initialTargetId={find} layout={layout} />;
}
