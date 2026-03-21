import { SubmissionForm } from "@/src/components/submission/submission-form";
import { isArchiveActionType } from "@/src/lib/archive";
import { getAllSubmissions, getEntryBySlug, getTaxonomy } from "@/src/lib/content";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Submit a Steve | As Steve on TV",
  description: "Report a Steve, confirm a sighting, dispute a record, add evidence, or suggest a correction."
});

export default async function SubmitPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const action = Array.isArray(params.action) ? params.action[0] : params.action;
  const entrySlug = Array.isArray(params.entry) ? params.entry[0] : params.entry;
  const [submissions, entry, taxonomy] = await Promise.all([
    getAllSubmissions(),
    entrySlug ? getEntryBySlug(entrySlug) : Promise.resolve(null),
    getTaxonomy()
  ]);
  const intakeType = isArchiveActionType(action) ? action : "report";

  return (
    <div className="document-page">
      <section className="document-card">
        <p className="section-label">Submission</p>
        <h1>Submit a Steve</h1>
        <p>
          Public submissions expand the archive. Editorial review decides what becomes canonical, how certainty is described,
          and which records remain unresolved.
        </p>
      </section>

      <SubmissionForm entry={entry} initialType={intakeType} mediums={taxonomy.mediums} variants={taxonomy.nameVariants} />

      <section className="document-card">
        <div className="document-card__header">
          <p className="section-label">Recent filings</p>
          <h2>Sample submissions</h2>
          <p>These sample items prove the moderation language and archive action model.</p>
        </div>
        <div className="queue-list">
          {submissions.map((submission) => (
            <article className="queue-item" key={submission.id}>
              <div className="queue-item__topline">
                <span>{submission.submissionType}</span>
                <span>{submission.status}</span>
              </div>
              <h3>{submission.subjectName}</h3>
              <p>
                {submission.titleOfWork} · {submission.medium} · {submission.approximateYear}
              </p>
              <p>{submission.whatWasSeen}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
