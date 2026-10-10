import type { CandidateEntry } from "@/src/lib/schema";
import type { ReviewDisposition } from "@/src/lib/schema/identity-appearance";

export function CandidateTable({
  rows
}: {
  rows: Array<{
    candidate: CandidateEntry;
    disposition: ReviewDisposition;
    reason: string;
    saved: boolean;
  }>;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Work</th>
            <th>Confidence</th>
            <th>Status</th>
            <th>Review</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.candidate.id}>
              <td>{row.candidate.displayName}</td>
              <td>{row.candidate.titleOfWork}</td>
              <td>{row.candidate.matchConfidence}</td>
              <td>{row.candidate.status}</td>
              <td data-review={row.disposition} title={row.reason}>
                {row.saved ? "Saved" : "Suggested"}: {row.disposition.replaceAll("_", " ")}
              </td>
              <td>{row.candidate.imdbTitleId ?? row.candidate.sourceTitleId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
