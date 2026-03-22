import { CandidateTable } from "@/src/components/admin/candidate-table";
import { SubmissionTable } from "@/src/components/admin/submission-table";
import { getAllSubmissions, getIngestRuns, getReviewQueue } from "@/src/lib/content";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Admin | As Steve on TV",
  description: "A lightweight admin scaffold for reviewing typed Steve submission fixtures."
});

export default async function AdminPage() {
  const [submissions, candidates, ingestRuns] = await Promise.all([
    getAllSubmissions(),
    getReviewQueue(),
    getIngestRuns()
  ]);
  const latestRun = ingestRuns[0] ?? null;

  return (
    <div className="stack">
      <div className="section-heading">
        <h1>Admin and moderation</h1>
        <p>
          This is not a full workflow system. It is a deliberately small proving ground for review states, editorial notes, and
          future moderation UI.
        </p>
      </div>
      <section className="document-card">
        <p className="section-label">Ingest</p>
        <h2>Latest run</h2>
        {latestRun ? (
          <p>
            {latestRun.provider} scanned {latestRun.recordsScanned} records and created {latestRun.candidatesCreated} candidates.
          </p>
        ) : (
          <p>No ingest runs have been recorded yet.</p>
        )}
      </section>
      <section className="document-card">
        <p className="section-label">Review queue</p>
        <h2>Candidate entries</h2>
        <CandidateTable candidates={candidates} />
      </section>
      <section className="document-card">
        <p className="section-label">Submissions</p>
        <h2>Public filings</h2>
        <SubmissionTable submissions={submissions} />
      </section>
    </div>
  );
}
