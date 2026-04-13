import { useState, useEffect } from "react";
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

function InventoryChartCard() {
  const [activeRange, setActiveRange] = useState("6 Months");
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/dashboard/inventory-consumption?range=${activeRange}`)
      .then(res => res.json())
      .then(fetchedData => {
        setData(fetchedData);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch inventory data:", err);
        setIsLoading(false);
      });
  }, [activeRange]);

  if (isLoading) {
    return (
      <section className="card-shell flex min-h-[460px] items-center justify-center p-6 border-dashed border-2 dark:border-dark-border">
        <span className="text-zinc-400 dark:text-zinc-500 font-medium">Loading Inventory Data...</span>
      </section>
    );
  }

  const safeData = Array.isArray(data) ? data : [];

  if (safeData.length === 0) {
    return (
      <section className="card-shell flex min-h-[460px] flex-col items-center justify-center p-6 text-center border-dashed border-2 border-zinc-200 dark:border-dark-border">
        <div className="h-16 w-16 rounded-full bg-zinc-50 flex items-center justify-center mb-4 dark:bg-dark-surface">
          <FiCircle className="h-8 w-8 text-zinc-300 animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 italic">No inventory consumption data yet</h3>
        <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
          Start recording invoices to see AI-powered charts and consumption trends.
        </p>
      </section>
    );
  }
  const allValues = safeData.flatMap((entry) => [entry.actual, entry.forecast]).filter((value) => value !== null);

  const min = allValues.length ? Math.min(...allValues) * 0.9 : 0;
  const max = allValues.length ? Math.max(...allValues) * 1.1 : 100;
  const span = Math.max(max - min, 1);

  const xStep = safeData.length > 1 ? (WIDTH - PADDING_X * 2) / (safeData.length - 1) : 0;

  const toY = (value) => HEIGHT - PADDING_Y - ((value - min) / span) * (HEIGHT - PADDING_Y * 2);

  const forecastPoints = safeData.map((entry, index) => ({
    x: PADDING_X + xStep * index,
    y: toY(entry.forecast),
  }));


  const actualPoints = safeData
    .map((entry, index) => (entry.actual === null ? null : { x: PADDING_X + xStep * index, y: toY(entry.actual) }))
    .filter(Boolean);


  const latestActualPoint = actualPoints.length > 0 ? actualPoints[actualPoints.length - 1] : null;
  const latestActualValue = safeData.filter((entry) => entry.actual !== null).at(-1)?.actual;


  return (
    <section className="card-shell p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Inventory Consumption</h3>
          <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">Actual usage compared with AutoVet prediction model.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-dark-surface">
          <button
            onClick={() => setActiveRange("6 Months")}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              activeRange === "6 Months"
                ? "bg-white text-zinc-700 shadow-sm dark:bg-dark-card dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            6 Months
          </button>
          <button
            onClick={() => setActiveRange("Year")}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeRange === "Year"
                ? "bg-white text-zinc-700 shadow-sm dark:bg-dark-card dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            Year
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-6 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <span className="inline-flex items-center gap-2">
          <FiCircle className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
          Actual Usage
        </span>
        <span className="inline-flex items-center gap-2">
          <FiCircle className="h-3.5 w-3.5 fill-zinc-300 text-zinc-400 dark:fill-zinc-500 dark:text-zinc-500" />
          AI Prediction
        </span>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-dark-border dark:bg-dark-surface">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[330px] w-full">
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
            <line
              key={ratio}
              x1={PADDING_X}
              y1={HEIGHT * ratio}
              x2={WIDTH - PADDING_X}
              y2={HEIGHT * ratio}
              className="stroke-zinc-200 dark:stroke-zinc-700"
              strokeDasharray="4 4"
            />
          ))}

          <path d={createPath(forecastPoints)} className="fill-none stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="2.5" strokeDasharray="8 8" />
          <path d={createPath(actualPoints)} className="fill-none stroke-emerald-500" strokeWidth="4" strokeLinecap="round" />

          {latestActualPoint ? (
            <>
              <circle cx={latestActualPoint.x} cy={latestActualPoint.y} r="6" className="fill-emerald-500" />
              <g transform={`translate(${latestActualPoint.x - 40}, ${latestActualPoint.y - 52})`}>
                <rect width="88" height="36" rx="8" className="fill-zinc-800 dark:fill-zinc-700" />
                <text x="44" y="23" textAnchor="middle" className="fill-white text-sm font-semibold">
                  {latestActualValue} units
                </text>
              </g>
            </>
          ) : null}
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400" style={{ gridTemplateColumns: `repeat(${safeData.length || 4}, minmax(0, 1fr))` }}>
        {safeData.map((entry, i) => (
          <span key={i}>{entry.month}</span>
        ))}
      </div>

    </section>
  );
}

export default InventoryChartCard;
