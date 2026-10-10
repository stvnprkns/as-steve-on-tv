import { StudyStory } from "@/src/components/studies/study-story";
import { loadStudyStory, publicStudyDirectory } from "@/src/lib/data/study-story";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Where have all the Steves gone? | As Steve on TV",
  description: "A film and television naming study. Charts appear only after a frozen snapshot passes QA."
});

export default async function WhereHaveAllTheStevesGonePage() {
  const view = await loadStudyStory(publicStudyDirectory());
  return <StudyStory view={view} />;
}
