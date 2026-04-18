import { useState, useEffect, useMemo } from "react";
import { FiCircle } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { useAuth } from "../../context/AuthContext";
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
    const { user } = useAuth();
    const [activeRange, setActiveRange] = useState("6 Months");
    const [data, setData] = useState([]);
    const [model, setModel] = useState(null);
    const [insights, setInsights] = useState([]);
    const [isDataset, setIsDataset] = useState(false);
    const [predictionSource, setPredictionSource] = useState("live");
    const [isLoading, setIsLoading] = useState(true);

    // Planning Mode States
    const [isPlanningMode, setIsPlanningMode] = useState(false);
    const [demandAdjustment, setDemandAdjustment] = useState(0); // Percentage change

    useEffect(() => {
        setIsLoading(true);
        fetch(`/api/dashboard/sales-forecast?range=${activeRange}`, {
            headers: {
                'Authorization': `Bearer ${user?.token}`,
                'Accept': 'application/json'
            }
        })
            .then(res => res.json())
            .then(fetchedData => {
                const { data: forecastData, model: modelData, insights: insightData, is_dataset_prediction, prediction_source } = fetchedData;
                
                setIsDataset(!!is_dataset_prediction);
                setPredictionSource(prediction_source || "live");

                if (Array.isArray(forecastData) && forecastData.length === 0 && modelData?.training_months === 0) {
                    setData([]);
                    setModel(null);
                    setInsights([]);
                } else {
                    setData(Array.isArray(forecastData) ? forecastData : []);
                    setModel(modelData ?? null);
                    setInsights(Array.isArray(insightData) ? insightData : []);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch forecast:", err);
                setIsLoading(false);
            });
    }, [activeRange, user?.token]);

    const safeData = Array.isArray(data) ? data : [];
    const isActuallyPlanning = isPlanningMode && demandAdjustment !== 0;
    
    // Calculate chart bounds
    const allValues = safeData.flatMap((entry) => {
        const vals = [entry.actual, entry.forecast];
        return vals;
    }).filter((value) => value !== null && !isNaN(value));

    const min = allValues.length ? Math.min(...allValues) * 0.9 : 0;
    const max = allValues.length ? Math.max(...allValues) * 1.1 : 10000;
    const span = Math.max(max - min, 1);

    const xStep = safeData.length > 1 ? (WIDTH - PADDING_X * 2) / (safeData.length - 1) : 0;
    const toY = (value) => HEIGHT - PADDING_Y - ((value - min) / span) * (HEIGHT - PADDING_Y * 2);

    const forecastPoints = safeData.map((entry, index) => ({
        x: PADDING_X + xStep * index,
        y: toY(entry.forecast),
    }));

    const adjustedPoints = safeData.map((entry, index) => ({
        x: PADDING_X + xStep * index,
        y: toY(entry.forecast * (1 + demandAdjustment / 100)),
    }));

    const actualPoints = safeData
        .map((entry, index) => (entry.actual === null ? null : { x: PADDING_X + xStep * index, y: toY(entry.actual) }))
        .filter(Boolean);

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
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h3 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                            <LuSparkles className="text-emerald-500 w-6 h-6" />
                            AI Sales Forecast
                        </h3>
                        {/* Prediction Source Badge */}
                        {!isLoading && model && (
                             <span className={clsx(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset",
                                isDataset 
                                    ? "bg-amber-100 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-500/30" 
                                    : "bg-emerald-100 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30"
                            )}>
                                <span className={clsx("h-1.5 w-1.5 rounded-full", isDataset ? "bg-amber-500" : "bg-emerald-500")} />
                                {isDataset ? "Dataset Fallback" : "Live Prediction"}
                            </span>
                        )}
                    </div>
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

            {/* PLANNING MODE CONTROLS */}
            {!isLoading && model && (
                <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/30 dark:bg-indigo-900/10 relative z-10">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
                                <LuSparkles className="h-5 w-5 animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Strategic Planning Mode</h4>
                                <p className="text-xs text-indigo-600 dark:text-indigo-400">Adjust the AI forecast based on expected demand changes.</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                             <div className="flex items-center gap-3 mr-4">
                                <span className="text-xs font-bold text-indigo-400">Expected Change:</span>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        className="h-10 w-28 rounded-xl border border-indigo-200 bg-white px-4 pr-8 text-sm font-bold text-indigo-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-indigo-800 dark:bg-zinc-900 dark:text-white"
                                        placeholder="0"
                                        value={demandAdjustment || ''}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setDemandAdjustment(isNaN(val) ? 0 : val);
                                            setIsPlanningMode(true);
                                        }}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-indigo-400">%</span>
                                </div>
                             </div>

                            {isPlanningMode && (
                                <button 
                                    onClick={() => {
                                        setIsPlanningMode(false);
                                        setDemandAdjustment(0);
                                    }}
                                    className="h-10 rounded-xl bg-white px-4 text-xs font-bold text-rose-600 border border-rose-100 hover:bg-rose-50 transition-colors shadow-sm dark:bg-zinc-900 dark:border-rose-900/30"
                                >
                                    Reset to AI Baseline
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. MODEL METRIC STRIP */}
            {model && (
                <div className="mb-3 flex flex-wrap gap-2 relative z-10">
                    {isActuallyPlanning && (
                        <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 animate-pulse">
                            <LuSparkles className="w-3 h-3" />
                            PLANNING MODE ACTIVE ({demandAdjustment > 0 ? '+' : ''}{demandAdjustment}%)
                        </div>
                    )}
                    <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-sm">
                        <LuSparkles className="w-3 h-3" />
                        AI Baseline Monthly: ₱{(model.ai_predicted_monthly_revenue ?? 0).toLocaleString('en-PH')}
                    </div>
                    
                    {isActuallyPlanning ? (
                         <div className="rounded-full px-3 py-1.5 text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-sm">
                            Planned Forecast: ₱{Math.round(model.next_month_forecast * (1 + demandAdjustment / 100)).toLocaleString('en-PH')}
                        </div>
                    ) : (
                        <div className="rounded-full px-3 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-dark-surface text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-dark-border">
                            Next month (Trend): ₱{(model.next_month_forecast || 0).toLocaleString('en-PH')}
                        </div>
                    )}

                    <div className="rounded-full px-3 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-dark-surface text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-dark-border">
                        Growth/mo: {model.slope >= 0 ? '+' : ''}₱{Math.round(model.slope).toLocaleString('en-PH')}
                    </div>
                    <div className="rounded-full px-3 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-dark-surface text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-dark-border">
                        R² accuracy: {model.r2}
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
            <div className="mb-4 flex flex-wrap items-center justify-between relative z-10">
                <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    <span className="inline-flex items-center gap-2">
                        <FiCircle className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
                        Actual Revenue
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <FiCircle className="h-3.5 w-3.5 fill-zinc-300 text-zinc-400 dark:fill-zinc-500 dark:text-zinc-500" />
                        AI Baseline
                    </span>
                    {isActuallyPlanning && (
                        <span className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                            <FiCircle className="h-3.5 w-3.5 fill-indigo-600 text-indigo-600 shadow-sm" />
                            Adjusted Forecast
                        </span>
                    )}
                </div>
                {isDataset && (
                    <span className="text-xs italic text-amber-600 dark:text-amber-400 font-medium animate-pulse">
                        * Training on historical CSV data
                    </span>
                )}
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

                        <path d={createPath(forecastPoints)} className="fill-none stroke-zinc-400 dark:stroke-zinc-600" strokeWidth="2" strokeDasharray="6 6" />
                        
                        {isActuallyPlanning && (
                             <path d={createPath(adjustedPoints)} className="fill-none stroke-indigo-500 transition-all duration-500" strokeWidth="4" strokeLinecap="round" />
                        )}

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
                                <rect width="90" height="24" rx="6" className={isActuallyPlanning ? "fill-zinc-400" : "fill-indigo-600"} />
                                <text x="45" y="16" textAnchor="middle" fill="white" className="text-[10px] font-bold">
                                    ₱{Math.round(lastForecastValue / 1000)}k {isActuallyPlanning ? 'base' : 'est.'}
                                </text>
                            </g>
                        )}
                    </svg>
                )}
            </div>

            {/* 6. MONTH LABELS ROW */}
            <div 
                className={clsx(
                    "mt-4 grid gap-1 text-center font-medium text-zinc-500 dark:text-zinc-400 relative z-10",
                    safeData.length > 8 ? "text-[10px]" : "text-sm"
                )} 
                style={{ gridTemplateColumns: `repeat(${safeData.length || 7}, minmax(0, 1fr))` }}
            >
                {safeData.map((entry, i) => (
                    <span key={i} className="truncate px-0.5">{entry.month}</span>
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
                <div className="mt-4 border-t border-zinc-100 dark:border-dark-border pt-4 relative z-10">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400 dark:text-zinc-500 font-medium tracking-wide uppercase">
                         <div className="flex items-center gap-4">
                            <span>Algorithm: {model.algorithm}</span>
                            <span>Slope: {model.slope}</span>
                            <span>R²: {model.r2}</span>
                            {isActuallyPlanning && <span className="text-indigo-600 font-bold tracking-normal">* Manual adjustment applied</span>}
                         </div>
                         <div className="flex items-center gap-1 italic">
                            <span>Model last updated:</span>
                            <span>{model.last_updated}</span>
                         </div>
                    </div>
                </div>
            )}

        </section>
    );
}

export default AiSalesForecastCard;
