import { buildMetadata } from "@/src/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Method | As Steve on TV",
  description: "Methodology, scope rules, verification language, and corrections policy for the archive."
});

export default function MethodPage() {
  return (
    <div className="document-page">
      <section className="document-card">
        <p className="section-label">Method</p>
        <h1>How the archive decides what counts</h1>
        <p>
          As Steve on TV is public-facing, community-fed, and editorially maintained. It accepts weird and underdocumented
          sightings, especially in the commercial lane, but it does not flatten uncertainty into fake certainty.
        </p>
      </section>

      <section className="document-card">
        <p className="section-label">Scope</p>
        <ul className="document-list">
          <li>In scope: Steve, Steven, Stephen, and Stevie appearances across television, film, and commercials.</li>
          <li>Out of scope: generic people databases, off-screen crew, podcasts, games, and broad internet video.</li>
          <li>Commercial records matter because conventional databases do a poor job of preserving them.</li>
        </ul>
      </section>

      <section className="document-card">
        <p className="section-label">Verification language</p>
        <ul className="document-list">
          <li>
            <strong>Verified</strong>: the record has sufficient editorial confidence and stable source support.
          </li>
          <li>
            <strong>Community-confirmed</strong>: the record is materially supported by public confirmations, but editorial review is still active.
          </li>
          <li>
            <strong>Needs verification</strong>: the sighting is plausible and worth tracking, but the evidence trail is thinner than preferred.
          </li>
          <li>
            <strong>Disputed</strong>: enough evidence exists to keep the record public, but the archive does not treat the claim as settled.
          </li>
          <li>
            <strong>Corrected</strong>: a previously filed record was amended in a meaningful way and the archive is keeping that visible.
          </li>
        </ul>
      </section>

      <section className="document-card">
        <p className="section-label">Contribution model</p>
        <ul className="document-list">
          <li>Use Report a Steve for missing records.</li>
          <li>Use Confirm sighting for records that are right but under-evidenced.</li>
          <li>Use Dispute when a record may be out of lane, overstated, or misattributed.</li>
          <li>Use Add evidence for timestamps, clips, campaign details, and source trails.</li>
          <li>Use Suggest correction for metadata and copy fixes.</li>
        </ul>
      </section>

      <section className="document-card">
        <p className="section-label">Corrections</p>
        <p>
          The archive would rather show a careful uncertainty note than quietly stretch the rules. Corrections and disputes are
          part of the product, not an embarrassment behind it.
        </p>
      </section>
    </div>
  );
}
