import { formatVerificationLabel } from "@/src/lib/archive";
import type { PublicRecordStatus } from "@/src/lib/schema";

export function VerificationBadge({ status }: { status: PublicRecordStatus }) {
  return (
    <span className={`verification-badge verification-badge--${status.replaceAll("_", "-")}`}>
      {formatVerificationLabel(status)}
    </span>
  );
}
