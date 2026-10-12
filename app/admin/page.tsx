import Link from "next/link";

import { CandidateTable } from "@/src/components/admin/candidate-table";
import { SubmissionTable } from "@/src/components/admin/submission-table";
import { suggestCandidateReviews } from "@/src/lib/data/identity-resolution";
import { getAllEntries, getAllSubmissions, getIngestRuns, getReviewQueue } from "@/src/lib/content";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Admin | As Steve on TV",
  description: "A lightweight admin scaffold for reviewing typed Steve submission fixtures."
});

export default async function AdminPage() {
  const [submissions, candidates, ingestRuns, entries] = await Promise.all([
    getAllSubmissions(),
    getReviewQueue(),
    getIngestRuns(),
    getAllEntries()
  ]);
  const latestRun = ingestRuns[0] ?? null;
  const reviewRows = suggestCandidateReviews(candidates, entries);

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
        <p className="section-label">Collage</p>
        <h2>Cutout studio</h2>
        <p>
          Turn a source frame into a transparent Steve, keep the mask for click hits, and leave display off until rights are
          reviewed.
        </p>
        <p>
          <Link className="text-link" href="/admin/cutouts">
            Open the cutout studio
          </Link>
        </p>
      </section>
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
        <p>
          Suggestions distinguish a new identity, a new appearance, a duplicate, an out-of-scope credit, or a credit that still
          needs evidence. They are not saved decisions, and they do not change published slugs.
        </p>
        <CandidateTable rows={reviewRows} />
      </section>
      <section className="document-card">
        <p className="section-label">Submissions</p>
        <h2>Public filings</h2>
        <SubmissionTable submissions={submissions} />
      </section>
    </div>
  );
}
