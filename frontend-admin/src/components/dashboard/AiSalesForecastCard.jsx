import { useState, useEffect } from "react";
import { FiCircle } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import clsx from "clsx";

const WIDTH = 760;
const HEIGHT = 320;
const PADDING_X = 24;
const PADDING_Y = 24;

function createPath(points) {
    if (!points || !points.length) return "";
    return points
        .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
        .join(" ");
}

function AiSalesForecastCard() {
    const [activeRange, setActiveRange] = useState("6 Months");
    const [data, setData] = useState([]);
    const [model, setModel] = useState(null);
    const [insights, setInsights] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        fetch(`/api/dashboard/sales-forecast?range=${activeRange}`)
            .then(res => res.json())
            .then(fetchedData => {
                const { data: forecastData, model: modelData, insights: insightData } = fetchedData;
                setData(Array.isArray(forecastData) ? forecastData : []);
                setModel(modelData ?? null);
                setInsights(Array.isArray(insightData) ? insightData : []);
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch forecast:", err);
                setIsLoading(false);
            });
    }, [activeRange]);

    const safeData = Array.isArray(data) ? data : [];
    
    // Calculate chart bounds
    const allValues = safeData.flatMap((entry) => {
        const vals = [entry.actual, entry.forecast];
        if (model?.confidence_margin) {
            vals.push(entry.forecast + model.confidence_margin);
            vals.push(entry.forecast - model.confidence_margin);
        }
        return vals;
    }).filter((value) => value !== null);

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

    // Confidence Band Calculation
    const upperPoints = forecastPoints.map((p, i) => ({ x: p.x, y: toY(safeData[i].forecast + (model?.confidence_margin ?? 0)) }));
    const lowerPoints = [...forecastPoints].reverse().map((p, i) => {
        const originalIndex = safeData.length - 1 - i;
        return { x: p.x, y: toY(safeData[originalIndex].forecast - (model?.confidence_margin ?? 0)) };
    });

    const bandPath = (model && model.confidence_margin) 
        ? 'M' + upperPoints.map(p => p.x.toFixed(1)+','+p.y.toFixed(1)).join(' L') + 
          ' L' + lowerPoints.map(p => p.x.toFixed(1)+','+p.y.toFixed(1)).join(' L') + ' Z'
        : "";

    const latestActualPoint = actualPoints.length > 0 ? actualPoints[actualPoints.length - 1] : null;
    const latestActualValue = safeData.filter((entry) => entry.actual !== null).at(-1)?.actual;

    const lastForecastPoint = forecastPoints.length > 0 ? forecastPoints[forecastPoints.length - 1] : null;
    const lastForecastValue = safeData.length > 0 ? safeData[safeData.length - 1].forecast : 0;

    const currency = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(val);

    return (
        <section className="card-shell p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10 dark:opacity-5 pointer-events-none">
                <LuSparkles className="w-32 h-32 text-emerald-500" />
            </div>

            {/* 1. HEADER ROW */}
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3 relative z-10">
                <div>
                    <h3 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <LuSparkles className="text-emerald-500 w-6 h-6" />
                        AI Sales Forecast
                    </h3>
                    <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">Projected revenue based on historical clinic data and seasonal trends.</p>
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

            {/* 2. MODEL METRIC STRIP */}
            {model && (
                <div className="mb-3 flex flex-wrap gap-2 relative z-10">
                    <div className="rounded-full px-3 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-dark-surface text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-dark-border">
                        Next month: ₱{model.next_month_forecast.toLocaleString('en-PH')}
                    </div>
                    <div className="rounded-full px-3 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-dark-surface text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-dark-border">
                        Growth/mo: {model.slope >= 0 ? '+' : ''}₱{Math.round(model.slope).toLocaleString('en-PH')}
                    </div>
                    <div className="rounded-full px-3 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-dark-surface text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-dark-border">
                        R² accuracy: {model.r2}
                    </div>
                    <div className="rounded-full px-3 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-dark-surface text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-dark-border">
                        Training data: {model.training_months} months
                    </div>
                </div>
            )}

            {/* 3. R² ACCURACY BAR */}
            {model && (
                <div className="mb-4 relative z-10">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Model fit (R²)</span>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div 
                            className="h-1.5 rounded-full bg-emerald-500 transition-all duration-700" 
                            style={{ width: `${(model?.r2 ?? 0) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* 4. LEGEND ROW */}
            <div className="mb-4 flex flex-wrap items-center gap-6 text-sm font-medium text-zinc-700 dark:text-zinc-300 relative z-10">
                <span className="inline-flex items-center gap-2">
                    <FiCircle className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
                    Actual Revenue
                </span>
                <span className="inline-flex items-center gap-2">
                    <FiCircle className="h-3.5 w-3.5 fill-zinc-300 text-zinc-400 dark:fill-zinc-500 dark:text-zinc-500" />
                    AI Prediction
                </span>
                <span className="inline-flex items-center gap-2">
                    <div className="h-3.5 w-3.5 bg-violet-400/30 border border-dashed border-violet-400" />
                    Confidence Band
                </span>
            </div>

            {/* 5. SVG CHART AREA */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-dark-border dark:bg-dark-surface relative z-10">
                {isLoading ? (
                    <div className="h-[330px] w-full flex items-center justify-center">
                        <div className="text-zinc-500 dark:text-zinc-400 font-medium">Loading AI Forecast...</div>
                    </div>
                ) : safeData.length === 0 ? (
                    <div className="h-[330px] w-full flex flex-col items-center justify-center text-center px-6">
                        <LuSparkles className="w-12 h-12 text-emerald-300 mb-4 opacity-50" />
                        <h4 className="text-zinc-700 dark:text-zinc-200 font-bold italic">Insufficient Data for AI Forecasting</h4>
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500 max-w-[200px]">
                            Once you have recorded sales over several weeks, our algorithm will begin projecting your future revenue.
                        </p>
                    </div>
                ) : (
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

                        {/* Confidence Band Polygon */}
                        {model && (
                            <polygon 
                                points={confidencePolygonPoints} 
                                fill="#a78bfa" 
                                fillOpacity="0.15" 
                            />
                        )}

                        <path d={createPath(forecastPoints)} className="fill-none stroke-violet-400 dark:stroke-violet-400" strokeWidth="2.5" strokeDasharray="8 8" />
                        <path d={createPath(actualPoints)} className="fill-none stroke-emerald-500" strokeWidth="4" strokeLinecap="round" />

                        {latestActualPoint && (
                            <>
                                <circle cx={latestActualPoint.x} cy={latestActualPoint.y} r="6" className="fill-emerald-500" />
                                <g transform={`translate(${latestActualPoint.x - 45}, ${latestActualPoint.y - 52})`}>
                                    <rect width="90" height="36" rx="8" className="fill-zinc-800 dark:fill-zinc-700" />
                                    <text x="45" y="23" textAnchor="middle" className="fill-white text-sm font-semibold">
                                        {currency(latestActualValue)}
                                    </text>
                                </g>
                            </>
                        )}

                        {lastForecastPoint && (
                            <g transform={`translate(${lastForecastPoint.x - 45}, ${lastForecastPoint.y + 15})`}>
                                <rect width="90" height="24" rx="6" fill="#7c3aed" />
                                <text x="45" y="16" textAnchor="middle" fill="white" className="text-[10px] font-bold">
                                    ₱{Math.round(lastForecastValue / 1000)}k est.
                                </text>
                            </g>
                        )}
                    </svg>
                )}
            </div>

            {/* 6. MONTH LABELS ROW */}
            <div className="mt-4 grid gap-3 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400 relative z-10" style={{ gridTemplateColumns: `repeat(${safeData.length || 7}, minmax(0, 1fr))` }}>
                {safeData.map((entry, i) => (
                    <span key={i}>{entry.month}</span>
                ))}
            </div>

            {/* 7. AI INSIGHT CARDS */}
            {insights.length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-2 relative z-10">
                    {insights.map((insight, idx) => {
                        const styleMap = {
                            success: "bg-emerald-50 dark:bg-emerald-900/20",
                            warning: "bg-amber-50 dark:bg-amber-900/20",
                            danger: "bg-rose-50 dark:bg-rose-900/20",
                            info: "bg-blue-50 dark:bg-blue-900/20"
                        };
                        const dotMap = {
                            success: "bg-emerald-500",
                            warning: "bg-amber-500",
                            danger: "bg-rose-500",
                            info: "bg-blue-500"
                        };
                        return (
                            <div key={idx} className={clsx("flex items-start gap-3 rounded-xl px-4 py-3", styleMap[insight.type])}>
                                <div className={clsx("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", dotMap[insight.type])} />
                                <p className="text-sm text-zinc-700 dark:text-zinc-300">{insight.text}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 8. MODEL METADATA FOOTER */}
            {model && (
                <p className="mt-3 text-[10px] text-zinc-400 dark:text-zinc-600 relative z-10 text-center">
                    {model.algorithm} · Last trained on invoice data · slope m={model.slope} · intercept b={Math.round(model.intercept)} · R²={model.r2}
                </p>
            )}

        </section>
    );
}

export default AiSalesForecastCard;
