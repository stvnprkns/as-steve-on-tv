"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CollageLayout, CollageSprite } from "@/src/lib/cutout/layout";

export type CollageFigure = {
  id: string;
  displayName: string;
  titleOfWork: string;
  yearStart?: number;
  actorOrPerson?: string;
  entrySlug?: string;
  evidenceUrl?: string;
  src: string;
};

type Props = {
  figures: CollageFigure[];
  layout: CollageLayout;
  initialTargetId?: string;
  preview?: boolean;
};

type View = { x: number; y: number; zoom: number };

const MIN_ZOOM = 0.28;
const MAX_ZOOM = 2.8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function CollageSurface({ figures, layout, initialTargetId, preview = false }: Props) {
  const byId = useMemo(() => new Map(figures.map((figure) => [figure.id, figure])), [figures]);
  const spriteById = useMemo(() => new Map(layout.sprites.map((sprite) => [sprite.cutoutId, sprite])), [layout.sprites]);
  const [view, setView] = useState<View>({ x: 80, y: 40, zoom: 0.55 });
  const [targetId, setTargetId] = useState<string | undefined>(
    initialTargetId && byId.has(initialTargetId) ? initialTargetId : figures[0]?.id
  );
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "found">("idle");
  const [foundCount, setFoundCount] = useState(0);
  const drag = useRef<{ x: number; y: number; viewX: number; viewY: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const pickNext = useCallback(
    (except?: string) => {
      const pool = figures.filter((figure) => figure.id !== except);
      if (!pool.length) {
        return except;
      }
      return pool[Math.floor(Math.random() * pool.length)]?.id;
    },
    [figures]
  );

  useEffect(() => {
    if (initialTargetId && byId.has(initialTargetId)) {
      setTargetId(initialTargetId);
    }
  }, [byId, initialTargetId]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) {
      return;
    }
    const onNativeWheel = (event: WheelEvent) => {
      const host = board.closest(".collage-breakout") ?? board;
      if (!host.contains(event.target as Node)) {
        return;
      }
      event.preventDefault();
      const rect = board.getBoundingClientRect();
      const current = viewRef.current;
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const nextZoom = clamp(current.zoom * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);
      const worldX = (cursorX - current.x) / current.zoom;
      const worldY = (cursorY - current.y) / current.zoom;
      setView({
        zoom: nextZoom,
        x: cursorX - worldX * nextZoom,
        y: cursorY - worldY * nextZoom
      });
    };
    window.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => window.removeEventListener("wheel", onNativeWheel);
  }, []);

  const target = targetId ? byId.get(targetId) : undefined;
  const selected = selectedId ? byId.get(selectedId) : null;

  function clientToWorld(event: { clientX: number; clientY: number }) {
    const board = boardRef.current;
    if (!board) {
      return { x: 0, y: 0 };
    }
    const rect = board.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - view.x) / view.zoom,
      y: (event.clientY - rect.top - view.y) / view.zoom
    };
  }

  function spriteContains(sprite: CollageSprite, point: { x: number; y: number }) {
    return point.x >= sprite.x && point.x <= sprite.x + sprite.width && point.y >= sprite.y && point.y <= sprite.y + sprite.height;
  }

  function sampleSpriteAlpha(sprite: CollageSprite, point: { x: number; y: number }) {
    const image = boardRef.current?.querySelector(`[data-cutout-id="${sprite.cutoutId}"] img`) as HTMLImageElement | null;
    if (!image || !image.naturalWidth || !image.complete) {
      return true;
    }
    const localX = Math.floor(((point.x - sprite.x) / sprite.width) * image.naturalWidth);
    const localY = Math.floor(((point.y - sprite.y) / sprite.height) * image.naturalHeight);
    if (localX < 0 || localY < 0 || localX >= image.naturalWidth || localY >= image.naturalHeight) {
      return false;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) {
      return true;
    }
    try {
      context.drawImage(image, localX, localY, 1, 1, 0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data[3] > 12;
    } catch {
      return true;
    }
  }

  function topSpriteAt(point: { x: number; y: number }) {
    return [...layout.sprites]
      .filter((sprite) => spriteContains(sprite, point))
      .sort((left, right) => right.zIndex - left.zIndex)
      .find((sprite) => sampleSpriteAlpha(sprite, point));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    drag.current = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = clientToWorld(event);
    const sprite = topSpriteAt(point);
    setHoverId(sprite?.cutoutId ?? null);

    const dragging = drag.current;
    if (!dragging) {
      return;
    }
    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      setView((current) => ({ ...current, x: dragging.viewX + dx, y: dragging.viewY + dy }));
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    drag.current = null;
    if (!start) {
      return;
    }
    const moved = Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 6;
    if (moved) {
      return;
    }

    const sprite = topSpriteAt(clientToWorld(event));
    if (!sprite) {
      setSelectedId(null);
      return;
    }

    const figure = byId.get(sprite.cutoutId);
    if (!figure) {
      return;
    }

    if (target && figure.id === target.id && status !== "found") {
      setStatus("found");
      setFoundCount((count) => count + 1);
      setSelectedId(figure.id);
      return;
    }

    setSelectedId(figure.id);
  }

  function nextRound() {
    setStatus("idle");
    setSelectedId(null);
    setTargetId(pickNext(targetId));
  }

  function challengeHref() {
    if (!target) {
      return "/";
    }
    const params = new URLSearchParams({
      find: target.id,
      x: String(Math.round(view.x)),
      y: String(Math.round(view.y)),
      z: String(view.zoom.toFixed(3))
    });
    return `/?${params.toString()}`;
  }

  const densityLabel = figures.length.toLocaleString("en-US");

  return (
    <div className={`collage-breakout${preview ? " collage-breakout--preview" : ""}`}>
      <div className="collage-hud">
        <p className="collage-kicker">There are a lot of Steves on TV.</p>
        <div className="find-card" aria-live="polite">
          {target ? (
            <>
              <div className="find-card__portrait">
                <img alt="" src={target.src} />
              </div>
              <div className="find-card__copy">
                <p className="find-card__label">{status === "found" ? "You found" : "Find this one."}</p>
                <h1>{target.displayName}</h1>
                <p>
                  {target.titleOfWork}
                  {target.yearStart ? `, ${target.yearStart}` : ""}
                </p>
                {status === "found" ? (
                  <button className="find-card__button" onClick={nextRound} type="button">
                    Find another Steve
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="find-card__copy">
              <p className="find-card__label">Find this one.</p>
              <h1>The collage is still being assembled.</h1>
              <p>Cutouts land here after editorial review. The archive list is still intact.</p>
              <Link className="find-card__button" href="/archive">
                Browse the filing cabinet
              </Link>
            </div>
          )}
        </div>
        <div className="density-counter">
          <p className="density-counter__count">{densityLabel} Steves</p>
          <p>And somehow, we&apos;re still missing some.</p>
          {foundCount ? <p className="density-counter__quiet">{foundCount} found this session.</p> : null}
          {target ? (
            <button
              className="density-counter__share"
              onClick={async () => {
                const url = new URL(challengeHref(), window.location.origin).toString();
                await navigator.clipboard.writeText(url);
              }}
              type="button"
            >
              Copy find-this-Steve link
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="collage-board"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={boardRef}
        role="application"
        aria-label="Steve collage canvas"
      >
        <div
          className="collage-world"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`
          }}
        >
          {layout.sprites.map((sprite) => {
            const figure = byId.get(sprite.cutoutId);
            if (!figure) {
              return null;
            }
            const isTarget = target?.id === figure.id && status === "found";
            const isHot = hoverId === figure.id || selectedId === figure.id || isTarget;
            return (
              <div
                className={`collage-sprite${isHot ? " collage-sprite--hot" : ""}`}
                data-cutout-id={figure.id}
                key={figure.id}
                style={{
                  left: sprite.x,
                  top: sprite.y,
                  width: sprite.width,
                  height: sprite.height,
                  zIndex: sprite.zIndex,
                  transform: `rotate(${sprite.rotation}deg)`
                }}
              >
                <img alt="" draggable={false} src={figure.src} />
                {hoverId === figure.id ? <span className="collage-sprite__label">{figure.displayName}</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      {selected && spriteById.get(selected.id) ? (
        <aside className="steve-info-card">
          <p className="steve-info-card__kicker">{target?.id === selected.id && status === "found" ? "Found" : "Steve"}</p>
          <h2>{selected.displayName}</h2>
          <p>
            {selected.titleOfWork}
            {selected.yearStart ? ` · ${selected.yearStart}` : ""}
          </p>
          {selected.actorOrPerson ? <p>{selected.actorOrPerson}</p> : null}
          <div className="steve-info-card__links">
            {selected.entrySlug ? (
              <Link href={`/steves/${selected.entrySlug}`}>Open the record</Link>
            ) : null}
            {selected.evidenceUrl ? (
              <a href={selected.evidenceUrl} rel="noreferrer" target="_blank">
                Source
              </a>
            ) : null}
            <button onClick={() => setSelectedId(null)} type="button">
              Close
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
