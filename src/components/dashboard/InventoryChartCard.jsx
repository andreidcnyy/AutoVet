import { useMemo, useState } from "react";
import { FiCircle } from "react-icons/fi";
import clsx from "clsx";

const WIDTH = 760;
const HEIGHT = 320;
const PADDING_X = 24;
const PADDING_Y = 24;

function createPath(points) {
  if (!points.length) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
}

function InventoryChartCard({ data = [] }) {
  const [activeRange, setActiveRange] = useState("6 Months");

  if (!data || data.length === 0) {
    return (
      <section className="card-shell flex min-h-[460px] items-center justify-center p-6 border-dashed border-2 dark:border-dark-border">
        <span className="text-slate-400 dark:text-zinc-500">Awaiting Inventory Data from API...</span>
      </section>
    );
  }

  const allValues = data.flatMap((entry) => [entry.actual, entry.forecast]).filter((value) => value !== null);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = Math.max(max - min, 1);

  const xStep = (WIDTH - PADDING_X * 2) / (data.length - 1);
  const toY = (value) => HEIGHT - PADDING_Y - ((value - min) / span) * (HEIGHT - PADDING_Y * 2);

  const forecastPoints = data.map((entry, index) => ({
    x: PADDING_X + xStep * index,
    y: toY(entry.forecast),
  }));

  const actualPoints = data
    .map((entry, index) => (entry.actual === null ? null : { x: PADDING_X + xStep * index, y: toY(entry.actual) }))
    .filter(Boolean);

  const latestActualPoint = actualPoints[actualPoints.length - 1];
  const latestActualValue = data.filter((entry) => entry.actual !== null).at(-1)?.actual;

  return (
    <section className="card-shell p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Inventory Consumption</h3>
          <p className="mt-1 text-base text-slate-500 dark:text-zinc-400">Actual usage compared with AutoVet prediction model.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1 dark:bg-dark-surface">
          <button
            onClick={() => setActiveRange("6 Months")}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              activeRange === "6 Months"
                ? "bg-white text-slate-700 shadow-sm dark:bg-dark-card dark:text-zinc-100"
                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            6 Months
          </button>
          <button
            onClick={() => setActiveRange("Year")}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeRange === "Year"
                ? "bg-white text-slate-700 shadow-sm dark:bg-dark-card dark:text-zinc-100"
                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            Year
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-6 text-sm font-medium text-slate-700 dark:text-zinc-300">
        <span className="inline-flex items-center gap-2">
          <FiCircle className="h-3.5 w-3.5 fill-blue-500 text-blue-500" />
          Actual Usage
        </span>
        <span className="inline-flex items-center gap-2">
          <FiCircle className="h-3.5 w-3.5 fill-slate-300 text-slate-400 dark:fill-zinc-500 dark:text-zinc-500" />
          AI Prediction
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-dark-border dark:bg-dark-surface">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[330px] w-full">
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
            <line
              key={ratio}
              x1={PADDING_X}
              y1={HEIGHT * ratio}
              x2={WIDTH - PADDING_X}
              y2={HEIGHT * ratio}
              className="stroke-slate-200 dark:stroke-zinc-700"
              strokeDasharray="4 4"
            />
          ))}

          <path d={createPath(forecastPoints)} className="fill-none stroke-slate-400 dark:stroke-zinc-500" strokeWidth="2.5" strokeDasharray="8 8" />
          <path d={createPath(actualPoints)} className="fill-none stroke-blue-500" strokeWidth="4" strokeLinecap="round" />

          {latestActualPoint ? (
            <>
              <circle cx={latestActualPoint.x} cy={latestActualPoint.y} r="6" className="fill-blue-500" />
              <g transform={`translate(${latestActualPoint.x - 40}, ${latestActualPoint.y - 52})`}>
                <rect width="88" height="36" rx="8" className="fill-zinc-800 dark:fill-zinc-700" />
                <text x="44" y="23" textAnchor="middle" className="fill-white text-sm font-semibold">
                  {latestActualValue} ml
                </text>
              </g>
            </>
          ) : null}
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 text-center text-sm font-medium text-slate-500 dark:text-zinc-400 md:grid-cols-7">
        {data.map((entry) => (
          <span key={entry.month}>{entry.month}</span>
        ))}
      </div>
    </section>
  );
}

export default InventoryChartCard;
