import { CutoutStudio } from "@/src/components/admin/cutout-studio";
import { getAllCutouts, getAllEntries } from "@/src/lib/content";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Cutout studio | As Steve on TV",
  description: "Internal tool for turning source frames into collage-ready Steve cutouts."
});

export default async function CutoutStudioPage() {
  const [entries, cutouts] = await Promise.all([getAllEntries(), getAllCutouts()]);

  return (
    <div className="stack">
      <div className="section-heading">
        <h1>Cutout studio</h1>
        <p>Upload a frame, box Steve if the scene is crowded, review the silhouette, then hold the original for rights.</p>
      </div>
      <CutoutStudio
        entries={entries.map((entry) => ({
          id: entry.id,
          displayName: entry.displayName,
          titleOfWork: entry.titleOfWork
        }))}
        initialCutouts={cutouts}
      />
    </div>
  );
}
