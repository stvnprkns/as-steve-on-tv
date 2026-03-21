import { SubmissionTable } from "@/src/components/admin/submission-table";
import { getAllSubmissions } from "@/src/lib/content";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Admin | As Steve on TV",
  description: "A lightweight admin scaffold for reviewing typed Steve submission fixtures."
});

export default async function AdminPage() {
  const submissions = await getAllSubmissions();

  return (
    <div className="stack">
      <div className="section-heading">
        <h1>Admin and moderation</h1>
        <p>
          This is not a full workflow system. It is a deliberately small proving ground for review states, editorial notes, and
          future moderation UI.
        </p>
      </div>
      <SubmissionTable submissions={submissions} />
    </div>
  );
}

