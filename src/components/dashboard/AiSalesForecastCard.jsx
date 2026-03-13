import { useState } from "react";
import { FiCircle } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
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

const mockSalesData = [
    { month: "Jul", actual: 125000, forecast: 120000 },
    { month: "Aug", actual: 142000, forecast: 135000 },
    { month: "Sep", actual: 138000, forecast: 140000 },
    { month: "Oct", actual: 155000, forecast: 148000 },
    { month: "Nov", actual: 162000, forecast: 158000 },
    { month: "Dec", actual: null, forecast: 185000 },
    { month: "Jan", actual: null, forecast: 172000 },
];

function AiSalesForecastCard() {
    const [activeRange, setActiveRange] = useState("6 Months");
    const data = mockSalesData;

    const allValues = data.flatMap((entry) => [entry.actual, entry.forecast]).filter((value) => value !== null);
    const min = Math.min(...allValues) * 0.9;
    const max = Math.max(...allValues) * 1.1;
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

    const currency = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(val);

    return (
        <section className="card-shell p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10 dark:opacity-5 pointer-events-none">
                <LuSparkles className="w-32 h-32 text-emerald-500" />
            </div>

            <div className="mb-6 flex flex-wrap items-start justify-between gap-3 relative z-10">
                <div>
                    <h3 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                        <LuSparkles className="text-emerald-500 w-6 h-6" />
                        AI Sales Forecast
                    </h3>
                    <p className="mt-1 text-base text-slate-500 dark:text-zinc-400">Projected revenue based on historical clinic data and seasonal trends.</p>
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

            <div className="mb-4 flex flex-wrap items-center gap-6 text-sm font-medium text-slate-700 dark:text-zinc-300 relative z-10">
                <span className="inline-flex items-center gap-2">
                    <FiCircle className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
                    Actual Revenue
                </span>
                <span className="inline-flex items-center gap-2">
                    <FiCircle className="h-3.5 w-3.5 fill-slate-300 text-slate-400 dark:fill-zinc-500 dark:text-zinc-500" />
                    AI Prediction
                </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-dark-border dark:bg-dark-surface relative z-10">
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
                    <path d={createPath(actualPoints)} className="fill-none stroke-emerald-500" strokeWidth="4" strokeLinecap="round" />

                    {latestActualPoint ? (
                        <>
                            <circle cx={latestActualPoint.x} cy={latestActualPoint.y} r="6" className="fill-emerald-500" />
                            <g transform={`translate(${latestActualPoint.x - 45}, ${latestActualPoint.y - 52})`}>
                                <rect width="90" height="36" rx="8" className="fill-zinc-800 dark:fill-zinc-700" />
                                <text x="45" y="23" textAnchor="middle" className="fill-white text-sm font-semibold">
                                    {currency(latestActualValue)}
                                </text>
                            </g>
                        </>
                    ) : null}
                </svg>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-3 text-center text-sm font-medium text-slate-500 dark:text-zinc-400 relative z-10">
                {data.map((entry) => (
                    <span key={entry.month}>{entry.month}</span>
                ))}
            </div>
        </section>
    );
}

export default AiSalesForecastCard;
