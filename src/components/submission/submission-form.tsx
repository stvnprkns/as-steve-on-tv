export function SubmissionForm() {
  return (
    <section className="stack">
      <div className="section-heading">
        <h2>Submission flow scaffold</h2>
        <p>This is a non-persistent MVP stub. The schema, moderation states, and admin view are now ready for wiring.</p>
      </div>
      <form className="form-card">
        <label>
          Proposed Steve
          <input disabled placeholder="Steve Brule" />
        </label>
        <label>
          Title of work
          <input disabled placeholder="Check It Out! with Dr. Steve Brule" />
        </label>
        <label>
          Evidence URL
          <input disabled placeholder="https://example.com/evidence" />
        </label>
        <label>
          Notes
          <textarea disabled placeholder="Why this belongs in the archive." rows={5} />
        </label>
        <button disabled type="button">
          Submission wiring comes next
        </button>
      </form>
    </section>
  );
}

