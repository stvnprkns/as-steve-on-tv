"use client";

import { useMemo, useRef, useState } from "react";

import type { SteveCutout } from "@/src/lib/schema/cutout";
import type { SteveEntry } from "@/src/lib/schema/steve-entry";

type Selection = { x: number; y: number; width: number; height: number };

export function CutoutStudio({
  entries,
  initialCutouts
}: {
  entries: Array<Pick<SteveEntry, "id" | "displayName" | "titleOfWork">>;
  initialCutouts: SteveCutout[];
}) {
  const [cutouts, setCutouts] = useState(initialCutouts);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<SteveCutout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [entryId, setEntryId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [cropType, setCropType] = useState<"upper-body" | "face">("upper-body");

  const entryOptions = useMemo(
    () => [...entries].sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [entries]
  );

  function onFile(next: File | null) {
    setFile(next);
    setResult(null);
    setSelection(null);
    setError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  function localPoint(event: React.PointerEvent<HTMLDivElement>) {
    const image = imageRef.current;
    if (!image) {
      return { x: 0, y: 0 };
    }
    const rect = image.getBoundingClientRect();
    const scaleX = image.naturalWidth / rect.width;
    const scaleY = image.naturalHeight / rect.height;
    return {
      x: Math.round(Math.min(image.naturalWidth, Math.max(0, (event.clientX - rect.left) * scaleX))),
      y: Math.round(Math.min(image.naturalHeight, Math.max(0, (event.clientY - rect.top) * scaleY)))
    };
  }

  async function processImage() {
    if (!file) {
      setError("Choose a source frame first.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("displayName", displayName);
    body.set("sourceTitle", sourceTitle);
    body.set("entryId", entryId);
    body.set("sourceUrl", sourceUrl);
    body.set("cropType", cropType);
    if (selection) {
      body.set("selection", JSON.stringify(selection));
    }

    const response = await fetch("/api/admin/cutouts", { method: "POST", body });
    const payload = (await response.json()) as { cutout?: SteveCutout; error?: string };
    setBusy(false);
    if (!response.ok || !payload.cutout) {
      setError(payload.error ?? "Processing failed.");
      return;
    }
    setResult(payload.cutout);
    setCutouts((current) => [payload.cutout!, ...current.filter((row) => row.id !== payload.cutout!.id)]);
  }

  async function updateCutout(id: string, patch: { status?: SteveCutout["status"]; displayAllowed?: boolean }) {
    const response = await fetch(`/api/admin/cutouts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const payload = (await response.json()) as { cutout?: SteveCutout; error?: string };
    if (!response.ok || !payload.cutout) {
      setError(payload.error ?? "Update failed.");
      return;
    }
    setResult(payload.cutout);
    setCutouts((current) => current.map((row) => (row.id === payload.cutout!.id ? payload.cutout! : row)));
  }

  return (
    <div className="cutout-studio">
      <section className="document-card">
        <p className="section-label">Source frame</p>
        <h2>Select Steve, then cut</h2>
        <p>
          Draw a box when more than one person is in the frame. remove.bg runs when <code>REMOVEBG_API_KEY</code> is set.
          Transparent PNGs can skip the API. Display stays off until you explicitly allow it.
        </p>
        <label className="cutout-studio__file">
          <span>Screenshot</span>
          <input
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        {previewUrl ? (
          <div
            className="cutout-studio__stage"
            onPointerDown={(event) => {
              drag.current = localPoint(event);
              setSelection(null);
            }}
            onPointerMove={(event) => {
              if (!drag.current) {
                return;
              }
              const point = localPoint(event);
              const x = Math.min(drag.current.x, point.x);
              const y = Math.min(drag.current.y, point.y);
              setSelection({
                x,
                y,
                width: Math.abs(point.x - drag.current.x),
                height: Math.abs(point.y - drag.current.y)
              });
            }}
            onPointerUp={() => {
              drag.current = null;
              if (selection && (selection.width < 8 || selection.height < 8)) {
                setSelection(null);
              }
            }}
          >
            <img alt="Source frame" ref={imageRef} src={previewUrl} />
            {selection ? (
              <span
                className="cutout-studio__selection"
                style={{
                  left: `${selection.x / (imageRef.current?.naturalWidth || 1) * 100}%`,
                  top: `${selection.y / (imageRef.current?.naturalHeight || 1) * 100}%`,
                  width: `${selection.width / (imageRef.current?.naturalWidth || 1) * 100}%`,
                  height: `${selection.height / (imageRef.current?.naturalHeight || 1) * 100}%`
                }}
              />
            ) : null}
          </div>
        ) : null}
        <div className="intake-form__row">
          <label>
            Display name
            <input onChange={(event) => setDisplayName(event.target.value)} value={displayName} />
          </label>
          <label>
            Source title
            <input onChange={(event) => setSourceTitle(event.target.value)} value={sourceTitle} />
          </label>
        </div>
        <div className="intake-form__row">
          <label>
            Archive entry
            <select onChange={(event) => setEntryId(event.target.value)} value={entryId}>
              <option value="">Not linked yet</option>
              {entryOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.displayName} — {entry.titleOfWork}
                </option>
              ))}
            </select>
          </label>
          <label>
            Crop
            <select onChange={(event) => setCropType(event.target.value as "upper-body" | "face")} value={cropType}>
              <option value="upper-body">Head and upper body</option>
              <option value="face">Face</option>
            </select>
          </label>
        </div>
        <label>
          Source URL
          <input onChange={(event) => setSourceUrl(event.target.value)} value={sourceUrl} />
        </label>
        <button className="find-card__button" disabled={busy} onClick={() => void processImage()} type="button">
          {busy ? "Cutting…" : "Make cutout"}
        </button>
        {error ? <p className="cutout-studio__error">{error}</p> : null}
      </section>

      {result ? (
        <section className="document-card">
          <p className="section-label">Review</p>
          <h2>{result.displayName}</h2>
          <div className="cutout-studio__result">
            <div className="cutout-studio__checker">
              <img alt={`${result.displayName} cutout`} src={`/api/admin/cutouts/${result.id}/asset?kind=cutout`} />
            </div>
            <div className="cutout-studio__checker">
              <img alt="" src={`/api/admin/cutouts/${result.id}/asset?kind=mask`} />
            </div>
          </div>
          <p>
            Provider {result.provider}. Rights default to hidden. Original and mask are on disk beside the cutout.
          </p>
          <div className="cutout-studio__actions">
            <button onClick={() => void updateCutout(result.id, { status: "reviewed" })} type="button">
              Mark reviewed
            </button>
            <button onClick={() => void updateCutout(result.id, { status: "collage-ready" })} type="button">
              Ready for collage
            </button>
            <button onClick={() => void updateCutout(result.id, { displayAllowed: true, status: "collage-ready" })} type="button">
              Allow public display
            </button>
          </div>
        </section>
      ) : null}

      <section className="document-card">
        <p className="section-label">Shelf</p>
        <h2>Saved cutouts</h2>
        {cutouts.length ? (
          <ul className="cutout-studio__list">
            {cutouts.map((cutout) => (
              <li key={cutout.id}>
                <strong>{cutout.displayName}</strong>
                <span>
                  {cutout.status} · {cutout.imageRights.displayAllowed ? "displayable" : "held"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No cutouts yet.</p>
        )}
      </section>
    </div>
  );
}
