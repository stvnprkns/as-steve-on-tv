import type { Submission } from "@/src/lib/schema";

export function SubmissionTable({ submissions }: { submissions: Submission[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Medium</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission) => (
            <tr key={submission.id}>
              <td>{submission.proposedName}</td>
              <td>{submission.submissionType}</td>
              <td>{submission.proposedMedium}</td>
              <td>{submission.status}</td>
              <td>{submission.updatedAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

