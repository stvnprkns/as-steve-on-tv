"use client";

import { useState } from "react";

import type { Medium, NameVariant, SteveEntry, SubmissionType } from "@/src/lib/schema";

function getDefaultWhatWasSeen(action: SubmissionType, entry: SteveEntry | null) {
  if (!entry) {
    return "";
  }

  switch (action) {
    case "confirm":
      return `${entry.displayName} is a legitimate archive inclusion in ${entry.titleOfWork}.`;
    case "dispute":
      return `${entry.displayName} may be overstated or misfiled in the current record.`;
    case "evidence":
      return `Additional evidence exists for ${entry.displayName} in ${entry.titleOfWork}.`;
    case "correction":
      return `One part of the ${entry.displayName} record appears to need correction or clarification.`;
    case "report":
    default:
      return "";
  }
}

function getActionLabel(action: SubmissionType) {
  switch (action) {
    case "confirm":
      return "Confirm sighting";
    case "dispute":
      return "Dispute";
    case "evidence":
      return "Add evidence";
    case "correction":
      return "Suggest correction";
    case "report":
    default:
      return "Report a Steve";
  }
}

export function SubmissionForm({
  entry,
  initialType,
  mediums,
  variants
}: {
  entry: SteveEntry | null;
  initialType: SubmissionType;
  mediums: readonly Medium[];
  variants: readonly NameVariant[];
}) {
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    action: string;
    subjectName: string;
    titleOfWork: string;
    approximateYear: string;
    submittedAt: string;
  } | null>(null);

  return (
    <section className="document-card">
      <div className="document-card__header">
        <p className="section-label">Submission</p>
        <h2>{entry ? `${getActionLabel(initialType)} for ${entry.displayName}` : "Report a Steve"}</h2>
        <p>
          This form captures the archive vocabulary and prefills known records. It is still a prototype intake layer, so
          submissions are previewed locally rather than saved.
        </p>
      </div>

      <form
        className="intake-form"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          setReceipt({
            action: getActionLabel((formData.get("submissionType") as SubmissionType | null) ?? initialType),
            subjectName: String(formData.get("subjectName") ?? "").trim(),
            titleOfWork: String(formData.get("titleOfWork") ?? "").trim(),
            approximateYear: String(formData.get("approximateYear") ?? "").trim(),
            submittedAt: new Date().toLocaleString()
          });
          setPreviewMessage("Prototype only. The record was not submitted, but the intake fields and action model are now in place.");
        }}
      >
        <label>
          Action
          <select defaultValue={initialType} name="submissionType">
            <option value="report">Report a Steve</option>
            <option value="confirm">Confirm sighting</option>
            <option value="dispute">Dispute</option>
            <option value="evidence">Add evidence</option>
            <option value="correction">Suggest correction</option>
          </select>
        </label>

        <label>
          Reported name
          <input defaultValue={entry?.displayName ?? ""} name="subjectName" placeholder="Dr. Steve Brule" required />
        </label>

        <label>
          Title or source
          <input
            defaultValue={entry?.titleOfWork ?? ""}
            name="titleOfWork"
            placeholder="Check It Out! with Dr. Steve Brule"
            required
          />
        </label>

        <div className="intake-form__row">
          <label>
            Medium
            <select defaultValue={entry?.medium ?? "tv"} name="medium">
              {mediums.map((medium) => (
                <option key={medium} value={medium}>
                  {medium}
                </option>
              ))}
            </select>
          </label>

          <label>
            Variant
            <select defaultValue={entry?.nameVariant ?? "steve"} name="variant">
              {variants.map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>
          </label>

          <label>
            Approximate year or decade
            <input defaultValue={entry?.era ?? ""} name="approximateYear" placeholder="2000s" required />
          </label>
        </div>

        <label>
          What was seen
          <textarea
            defaultValue={getDefaultWhatWasSeen(initialType, entry)}
            name="whatWasSeen"
            placeholder="Describe the sighting, scene, episode, ad slot, or record issue."
            rows={5}
            required
          />
        </label>

        <label>
          Evidence URL
          <input defaultValue="" name="evidenceUrl" placeholder="https://example.com/clip-or-source" type="url" />
        </label>

        <label>
          Evidence description
          <textarea
            defaultValue=""
            name="evidenceDescription"
            placeholder="If no link is available, describe the evidence trail, timestamp, ad slot, episode detail, or source condition."
            rows={4}
          />
        </label>

        <label>
          Additional note
          <textarea
            defaultValue=""
            name="notes"
            placeholder="Context, uncertainty, or why this matters to the archive."
            rows={4}
          />
        </label>

        <div className="intake-form__row">
          <label>
            Performer or person, if known
            <input defaultValue={entry?.actorOrPerson ?? ""} name="performer" placeholder="Joe Keery" />
          </label>

          <label>
            Contact email (optional)
            <input defaultValue="" name="contactEmail" placeholder="Optional follow-up email" type="email" />
          </label>
        </div>

        <button type="submit">Submit</button>
      </form>

      {previewMessage ? <p className="intake-form__note">{previewMessage}</p> : null}

      {receipt ? (
        <section className="intake-receipt">
          <p className="section-label">Local receipt</p>
          <h3>{receipt.action}</h3>
          <p>
            {receipt.subjectName || "Unnamed record"} · {receipt.titleOfWork || "Untitled source"} ·{" "}
            {receipt.approximateYear || "No year filed"}
          </p>
          <p>Captured locally at {receipt.submittedAt}.</p>
        </section>
      ) : null}
    </section>
  );
}
