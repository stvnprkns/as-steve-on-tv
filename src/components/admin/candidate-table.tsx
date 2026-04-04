import type { CandidateEntry } from "@/src/lib/schema";

export function CandidateTable({ candidates }: { candidates: CandidateEntry[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Work</th>
            <th>Confidence</th>
            <th>Status</th>
            <th>Linked entry</th>
            <th>Match reason</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr key={candidate.id}>
              <td>{candidate.displayName}</td>
              <td>{candidate.titleOfWork}</td>
              <td>{candidate.matchConfidence}</td>
              <td>{candidate.status}</td>
              <td>{candidate.linkedPublishedEntryId ?? "None"}</td>
              <td>{candidate.matchReason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
