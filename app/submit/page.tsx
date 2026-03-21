import { SubmissionForm } from "@/src/components/submission/submission-form";
import { getAllSubmissions } from "@/src/lib/content";
import { buildMetadata } from "@/src/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Submit a Steve | As Steve on TV",
  description: "A stubbed submission route backed by typed fixture data and moderation statuses."
});

export default async function SubmitPage() {
  const submissions = await getAllSubmissions();

  return (
    <div className="stack">
      <div className="section-heading">
        <h1>Submit a Steve</h1>
        <p>This route is intentionally light. The schema and review states exist before persistence wiring begins.</p>
      </div>
      <SubmissionForm />
      <section className="stack">
        <div className="section-heading">
          <h2>Fixture submissions</h2>
          <p>Development examples that prove the moderation model.</p>
        </div>
        <div className="grid grid--two">
          {submissions.map((submission) => (
            <article className="card" key={submission.id}>
              <div className="card__meta">
                <span>{submission.submissionType}</span>
                <span>{submission.status}</span>
              </div>
              <h3 className="card__title">{submission.proposedName}</h3>
              <p className="card__subtitle">{submission.titleOfWork}</p>
              <p className="card__body">{submission.notes}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

