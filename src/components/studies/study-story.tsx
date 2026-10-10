import React, { type ReactNode } from "react";

import type { BirthPoint, LagPoint, RatePoint, StoryView } from "@/src/lib/data/study-story";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 168;

export function StudyStory({ view }: { view: StoryView }) {
  return (
    <article className="study-page">
      <header className="document-card">
        <p className="section-label">Study</p>
        <h1>{view.title}</h1>
        <p>{view.question}</p>
        {view.status === "in_progress" ? (
          <p>Charts will be drawn from a QA-passed export. Until that export is published, this page stops at the question and the rules.</p>
        ) : (
          <p>The charts below are the frozen export. The question stays open.</p>
        )}
      </header>

      <section className="document-card">
        <h2>Rules</h2>
        <ul className="document-list">
          {view.methodology.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {view.status === "published" ? <PublishedStudy view={view} /> : null}

      <section className="document-card">
        <h2>Commercials</h2>
        <p>{view.commercialNote}</p>
      </section>

      <section className="document-card">
        <h2>Archive</h2>
        <p>{view.indexNote}</p>
        <ul className="document-list">
          <li>
            <a href="/">Browse the archive</a>
          </li>
          <li>
            <a href="/method">How the archive decides what counts</a>
          </li>
        </ul>
      </section>
    </article>
  );
}

function PublishedStudy({ view }: { view: Extract<StoryView, { status: "published" }> }) {
  return (
    <>
      <section className="document-card">
        <h2>New Steve-family introductions</h2>
        <p>Per 1,000 eligible new named characters. Film and television stay apart.</p>
        <RateChart label="Film introductions" points={view.primary.filter((point) => point.medium === "film")} />
        <RateChart label="Television introductions" points={view.primary.filter((point) => point.medium === "tv")} />
      </section>

      <section className="document-card">
        <h2>Control names</h2>
        <p>Same introduction denominator, shown beside the Steve-family group.</p>
        <RateTable caption="Introduction rates by decade" points={view.controls} />
      </section>

      <section className="document-card">
        <h2>Birth names</h2>
        <p>{view.populationsDiffer}</p>
        <BirthChart points={view.births} />
      </section>

      <section className="document-card">
        <h2>Lag scan</h2>
        <p>Every predeclared window is listed. None is marked as the result.</p>
        <LagTable points={view.lags} />
      </section>

      <section className="document-card">
        <h2>Footnotes</h2>
        <ul className="document-list">
          {view.summary.footnotes.map((footnote) => (
            <li key={footnote}>{footnote}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

function RateChart({ label, points }: { label: string; points: RatePoint[] }) {
  const published = points.filter((point) => point.rate !== null);
  const peak = Math.max(1000, ...published.map((point) => point.rate ?? 0));
  const geometry = chartScale(points.length, peak);

  return (
    <figure className="study-chart">
      <figcaption>{label}</figcaption>
      <svg aria-label={label} role="img" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <title>{label}</title>
        <line className="study-chart__axis" x1={geometry.padL} x2={CHART_WIDTH - geometry.padR} y1={geometry.baseline} y2={geometry.baseline} />
        {published.length === 0 ? (
          <text className="study-chart__empty" x={geometry.padL} y={84}>
            No published rate in this panel.
          </text>
        ) : (
          published.map((point) => {
            const index = points.indexOf(point);
            const cx = geometry.x(index);
            const cy = geometry.y(point.rate ?? 0);
            return <circle className="study-chart__point" cx={cx} cy={cy} key={`${point.medium}-${point.decade}`} r="3.5" />;
          })
        )}
        <Segments geometry={geometry} points={points} />
      </svg>
      <RateTable caption={`${label} values`} points={points} />
    </figure>
  );
}

function Segments({ geometry, points }: { geometry: ChartScale; points: RatePoint[] }) {
  const paths: string[][] = [];
  let current: string[] = [];

  points.forEach((point, index) => {
    if (point.rate === null) {
      if (current.length > 1) {
        paths.push(current);
      }
      current = [];
      return;
    }

    current.push(`${geometry.x(index)},${geometry.y(point.rate)}`);
  });

  if (current.length > 1) {
    paths.push(current);
  }

  return (
    <>
      {paths.map((path, index) => (
        <polyline className="study-chart__line" key={index} points={path.join(" ")} />
      ))}
    </>
  );
}

function BirthChart({ points }: { points: BirthPoint[] }) {
  const reported = points.filter((point) => point.rate !== null && point.observationState === "reported");
  const peak = Math.max(1, ...reported.map((point) => point.rate ?? 0));
  const geometry = chartScale(points.length, peak);

  return (
    <figure className="study-chart">
      <figcaption>Combined Steve-family births per 100,000 tabulated births</figcaption>
      <svg aria-label="Combined Steve-family birth share" role="img" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <title>Combined Steve-family birth share</title>
        <line className="study-chart__axis" x1={geometry.padL} x2={CHART_WIDTH - geometry.padR} y1={geometry.baseline} y2={geometry.baseline} />
        {reported.length === 0 ? (
          <text className="study-chart__empty" x={geometry.padL} y={84}>
            No reported birth share in this export.
          </text>
        ) : null}
        <BirthSegments geometry={geometry} points={points} />
      </svg>
      <div className="table-wrap">
        <table className="data-table">
          <caption>Combined Steve-family birth shares</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Numerator</th>
              <th scope="col">Denominator</th>
              <th scope="col">Per 100,000</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.year}>
                <td>{point.year}</td>
                <td>{cell(point.numerator)}</td>
                <td>{cell(point.denominator)}</td>
                <td>{formatRate(point.rate)}</td>
                <td>{point.observationState}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function BirthSegments({ geometry, points }: { geometry: ChartScale; points: BirthPoint[] }) {
  const paths: string[][] = [];
  let current: string[] = [];

  points.forEach((point, index) => {
    if (point.rate === null || point.observationState !== "reported") {
      if (current.length > 1) {
        paths.push(current);
      }
      current = [];
      return;
    }

    current.push(`${geometry.x(index)},${geometry.y(point.rate)}`);
  });

  if (current.length > 1) {
    paths.push(current);
  }

  return (
    <>
      {paths.map((path, index) => (
        <polyline className="study-chart__line" key={index} points={path.join(" ")} />
      ))}
    </>
  );
}

function RateTable({ caption, points }: { caption: string; points: RatePoint[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Decade</th>
            <th scope="col">Medium</th>
            <th scope="col">Name</th>
            <th scope="col">Numerator</th>
            <th scope="col">Denominator</th>
            <th scope="col">Per 1,000</th>
            <th scope="col">Interval</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={`${point.medium}-${point.decade}-${point.variant}`}>
              <td>{point.decade}</td>
              <td>{point.medium}</td>
              <td>{point.variant}</td>
              <td>{cell(point.numerator)}</td>
              <td>{cell(point.denominator)}</td>
              <td>{formatRate(point.rate)}</td>
              <td>{interval(point)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LagTable({ points }: { points: LagPoint[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Predeclared lag windows</caption>
        <thead>
          <tr>
            <th scope="col">Lag</th>
            <th scope="col">Medium</th>
            <th scope="col">Paired decades</th>
            <th scope="col">Correlation</th>
            <th scope="col">Status</th>
            <th scope="col">Selected</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={`${point.medium}-${point.lagYears}`}>
              <td>{point.lagYears}</td>
              <td>{point.medium}</td>
              <td>{point.pairedDecades}</td>
              <td>{formatRate(point.correlation)}</td>
              <td>{point.status}</td>
              <td>no</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ChartScale = {
  baseline: number;
  padL: number;
  padR: number;
  x: (index: number) => number;
  y: (rate: number) => number;
};

function chartScale(count: number, peak: number): ChartScale {
  const padL = 28;
  const padR = 12;
  const padT = 16;
  const padB = 22;
  const innerW = CHART_WIDTH - padL - padR;
  const innerH = CHART_HEIGHT - padT - padB;
  const safePeak = peak > 0 ? peak : 1;

  return {
    baseline: padT + innerH,
    padL,
    padR,
    x: (index) => padL + (count <= 1 ? innerW / 2 : (index / (count - 1)) * innerW),
    y: (rate) => padT + innerH - (rate / safePeak) * innerH
  };
}

function cell(value: number | null): ReactNode {
  return value === null ? "unpublished" : value;
}

export function formatRate(value: number | null): string {
  if (value === null) {
    return "unpublished";
  }

  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return String(rounded);
}

function interval(point: RatePoint): string {
  if (point.uncertaintyLow === null || point.uncertaintyHigh === null) {
    return "unpublished";
  }

  return `${formatRate(point.uncertaintyLow)}–${formatRate(point.uncertaintyHigh)}`;
}
