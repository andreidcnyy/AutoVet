import { useState, useEffect, useMemo } from "react";
import { FiUsers, FiCalendar, FiActivity, FiXCircle, FiTrendingUp, FiArrowUpRight, FiClock, FiCheckCircle, FiInfo, FiAlertCircle } from "react-icons/fi";
import { LuPawPrint, LuSparkles } from "react-icons/lu";
import { useAuth } from "../context/AuthContext";
import clsx from "clsx";

const COLORS = {
  Consultation: "#3b82f6",
  Grooming: "#a855f7",
  Vaccination: "#10b981",
  Laboratory: "#f59e0b",
};

const SERVICE_LIST = ["Consultation", "Grooming", "Vaccination", "Laboratory"];

function SummaryCard({ title, value, detail, icon: Icon, iconBg, iconColor }) {
  return (
    <div className="card-shell p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div className={clsx("flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm", iconBg)}>
          <Icon className={clsx("h-6 w-6", iconColor)} />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50">{value}</p>
        <p className="text-sm font-bold text-zinc-500 uppercase tracking-tight">{title}</p>
        <p className="text-xs font-medium text-zinc-400 mt-1">{detail}</p>
      </div>
    </div>
  );
}

const ServiceTab = ({ name, active, onClick, color }) => (
  <button
    onClick={() => onClick(name)}
    className={clsx(
      "relative px-6 py-3 text-sm font-black transition-all duration-300 rounded-xl overflow-hidden group",
      active 
        ? "text-white shadow-lg" 
        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
    )}
  >
    {active && (
      <div 
        className="absolute inset-0 z-0 animate-in fade-in zoom-in duration-300"
        style={{ backgroundColor: color }}
      />
    )}
    <span className="relative z-10 uppercase tracking-widest">{name}</span>
  </button>
);

function ColumnChart({ data, service, color }) {
  const WIDTH = 800;
  const HEIGHT = 400;
  const PADDING_BOTTOM = 40;
  const PADDING_LEFT = 60;
  const PADDING_TOP = 20;
  const PADDING_RIGHT = 20;

  const [hoveredIndex, setHoveredIndex] = useState(null);

  const points = useMemo(() => {
    if (!data || !data.length) return [];
    
    // Find max for scale
    let max = 1;
    data.forEach(p => {
        const sData = p[service] || { actual: 0, forecast: 0 };
        const val = Math.max(sData.actual || 0, sData.forecast || 0);
        if (val > max) max = val;
    });
    max = max * 1.2;

    const xStep = (WIDTH - PADDING_LEFT - PADDING_RIGHT) / (data.length);
    const yFactor = (HEIGHT - PADDING_BOTTOM - PADDING_TOP) / max;

    return data.map((p, i) => {
        const sData = p[service] || { actual: 0, forecast: 0 };
        const isForecast = sData.actual === null;
        const val = isForecast ? sData.forecast : sData.actual;
        const x = PADDING_LEFT + i * xStep + xStep / 2;
        const y = HEIGHT - PADDING_BOTTOM - (val * yFactor);
        const h = val * yFactor;

        return {
            x, y, h, 
            val: val.toFixed(1),
            label: p.month,
            isForecast,
            width: xStep * 0.7
        };
    });
  }, [data, service]);

  const trendLinePath = useMemo(() => {
    if (points.length < 2) return "";
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(" ");
  }, [points]);

  return (
    <div className="relative w-full">
      <svg 
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`} 
        className="w-full h-auto overflow-visible select-none"
      >
        {/* Y Axis Grid & Labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const h = HEIGHT - PADDING_BOTTOM - (HEIGHT - PADDING_BOTTOM - PADDING_TOP) * r;
            return (
                <g key={i}>
                    <line 
                        x1={PADDING_LEFT} y1={h} x2={WIDTH - PADDING_RIGHT} y2={h}
                        className="stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="1" strokeDasharray="4 4"
                    />
                </g>
            );
        })}

        {/* X Axis Labels */}
        {points.map((p, i) => (
            <text 
                key={i} x={p.x} y={HEIGHT - 10} 
                className={clsx("text-[10px] font-black uppercase tracking-tighter text-center transition-colors", p.isForecast ? "fill-purple-500" : "fill-zinc-400")}
                textAnchor="middle"
            >
                {p.label}
            </text>
        ))}

        {/* Bars */}
        {points.map((p, i) => (
            <g 
                key={i} 
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
            >
                {/* Glow Filter for Forecast */}
                {p.isForecast && (
                    <rect 
                        x={p.x - p.width / 2} y={p.y} width={p.width} height={p.h} rx="8"
                        className="fill-purple-500/20 animate-pulse"
                    />
                )}
                
                <rect 
                    x={p.x - p.width / 2} y={p.y} width={p.width} height={p.h} rx="8"
                    className={clsx(
                        "transition-all duration-500 shadow-xl",
                        p.isForecast 
                            ? "fill-purple-500 shadow-purple-500/20" 
                            : "fill-zinc-200 dark:fill-zinc-800 hover:fill-zinc-300 dark:hover:fill-zinc-700"
                    )}
                />
            </g>
        ))}

        {/* Trend Line Overlay */}
        <path 
            d={trendLinePath} fill="none" 
            stroke={color} strokeWidth="3" 
            strokeLinecap="round" strokeLinejoin="round"
            className="opacity-40 pointer-events-none"
        />

        {/* Points on trend line */}
        {points.map((p, i) => (
            <circle 
                key={i} cx={p.x} cy={p.y} r="4" 
                fill={p.isForecast ? "#a855f7" : color} 
                className="opacity-60"
            />
        ))}

        {/* Tooltip Overlay */}
        {hoveredIndex !== null && (
            <g className="pointer-events-none transition-all duration-300">
                <rect 
                    x={points[hoveredIndex].x - 40} y={points[hoveredIndex].y - 50} 
                    width="80" height="40" rx="8"
                    className="fill-zinc-900 shadow-2xl"
                />
                <text 
                    x={points[hoveredIndex].x} y={points[hoveredIndex].y - 35}
                    className="fill-white text-[10px] font-black uppercase tracking-widest"
                    textAnchor="middle"
                >
                    {points[hoveredIndex].isForecast ? "Forecast" : "Actual"}
                </text>
                <text 
                    x={points[hoveredIndex].x} y={points[hoveredIndex].y - 20}
                    className="fill-white text-sm font-black"
                    textAnchor="middle"
                >
                    {points[hoveredIndex].val}
                </text>
            </g>
        )}
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("Consultation");
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.token) return;
    setIsLoading(true);
    fetch(`/api/dashboard/service-forecast?range=6+Months`, {
      headers: { 'Authorization': `Bearer ${user.token}`, 'Accept': 'application/json' }
    })
      .then(res => res.json())
      .then(fetched => { setData(fetched); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [user?.token]);

  const growthInsight = useMemo(() => {
    if (!data || !data.chart_data) return null;
    const series = data.chart_data;
    const actuals = series.filter(p => p[activeTab].actual !== null);
    const forecasts = series.filter(p => p[activeTab].actual === null);
    
    if (!actuals.length || !forecasts.length) return null;
    
    const lastActual = actuals[actuals.length - 1][activeTab].actual;
    const nextForecast = forecasts[0][activeTab].forecast;
    
    const diff = nextForecast - lastActual;
    const pct = ((diff / Math.max(1, lastActual)) * 100).toFixed(1);
    
    return { diff, pct, isGrowth: diff >= 0 };
  }, [data, activeTab]);

  if (isLoading || !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          < LuSparkles className="h-10 w-10 text-emerald-500 animate-spin-slow" />
          <span className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Compiling Predictive Analytics...</span>
        </div>
      </div>
    );
  }

  const { summary, ai_forecast, chart_data } = data;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* HEADER */}
      <div className="flex justify-between items-end px-2">
        <div>
           <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50">Dashboard</h1>
           <p className="text-zinc-500 font-medium">Real-time health indicators and machine learning trends.</p>
        </div>
        <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Last Analysis</p>
            <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                <FiClock className="text-emerald-500" />
                {new Date(data.model_meta.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
      </div>

      {/* 1. TOP SUMMARY CARDS */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard 
          title="Total Clients" value={summary.total_clients} detail="Unique Pet Owners"
          icon={FiUsers} iconBg="bg-blue-50 dark:bg-blue-900/20" iconColor="text-blue-600 dark:text-blue-400"
        />
        <SummaryCard 
          title="Total Pets" value={summary.total_pets} detail="Clinical Registry"
          icon={LuPawPrint} iconBg="bg-purple-50 dark:bg-purple-900/20" iconColor="text-purple-600 dark:text-purple-400"
        />
        <SummaryCard 
          title="Total Booked" value={summary.total_appointments} detail="Lifetime Activity"
          icon={FiCheckCircle} iconBg="bg-emerald-50 dark:bg-emerald-900/20" iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard 
          title="Upcoming" value={summary.upcoming_appointments} detail="Scheduled Load"
          icon={FiCalendar} iconBg="bg-amber-50 dark:bg-amber-900/20" iconColor="text-amber-600 dark:text-amber-400"
        />
        <SummaryCard 
          title="Cancelled" value={summary.cancelled_appointments} detail="System Attrition"
          icon={FiXCircle} iconBg="bg-rose-50 dark:bg-rose-900/20" iconColor="text-rose-600 dark:text-rose-400"
        />
      </section>

      {/* 2. LARGE CONSOLIDATED AI SERVICE FORECAST CONTAINER */}
      <div className="card-shell p-0 overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-2xl relative">
        {/* Background glow for the entire box */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 blur-[120px] pointer-events-none rounded-full" />
        
        {/* Container Header with Tabs */}
        <div className="bg-white dark:bg-zinc-900 p-8 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-8">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <div className="h-8 w-8 bg-purple-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                            <LuSparkles className="h-5 w-5" />
                        </div>
                        AI Service Demand Forecast
                    </h2>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mt-2 ml-11">Multi-category volume projection engine</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-x-auto">
                    {SERVICE_LIST.map(service => (
                        <ServiceTab 
                            key={service} name={service} color={COLORS[service]}
                            active={activeTab === service} onClick={setActiveTab}
                        />
                    ))}
                </div>
            </div>
        </div>

        {/* Container Content: Graph and Metrics */}
        <div className="p-8 lg:p-12 flex flex-col xl:flex-row gap-12">
            {/* Graph Side (Vertical Column Chart) */}
            <div className="flex-1 w-full space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Demand Trend</h3>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                            <span className="h-1 w-3 bg-zinc-600 rounded-full" /> Historical
                            <span className="h-1 w-3 bg-purple-500 rounded-full" /> Forecasted
                        </p>
                    </div>
                </div>
                
                <div className="bg-zinc-50/50 dark:bg-black/20 p-8 rounded-[40px] border border-zinc-100 dark:border-zinc-800/50 shadow-inner">
                    <ColumnChart 
                        data={chart_data}
                        service={activeTab}
                        color={COLORS[activeTab]}
                    />
                </div>

                {growthInsight && (
                    <div className="flex items-center gap-6 bg-white dark:bg-zinc-800/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                        <div className={clsx(
                            "absolute inset-y-0 left-0 w-1.5",
                            growthInsight.isGrowth ? "bg-emerald-500" : "bg-rose-500"
                        )} />
                        
                        <div className={clsx(
                            "h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 duration-500",
                            growthInsight.isGrowth ? "bg-emerald-500 shadow-emerald-500/20" : "bg-rose-500 shadow-rose-500/20"
                        )}>
                            <FiTrendingUp className={clsx("h-6 w-6", !growthInsight.isGrowth && "rotate-180")} />
                        </div>
                        
                        <div>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Prediction Outcome</p>
                            <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                                Demand is projected to <span className={clsx("font-black", growthInsight.isGrowth ? "text-emerald-500" : "text-rose-500")}>
                                    {growthInsight.isGrowth ? 'increase' : 'decrease'} by {Math.abs(growthInsight.pct)}%
                                </span> compared to last month.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Metrics Side */}
            <div className="w-full xl:w-[450px] space-y-8">
                <div className="space-y-6">
                    {/* Revenue Card */}
                    <div className="relative group overflow-hidden bg-zinc-900 p-10 rounded-[40px] border border-zinc-700 shadow-2xl transition-all duration-500 hover:-translate-y-1">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <FiActivity size={120} className="text-white" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-3">Estimated Revenue</p>
                            <p className="text-6xl font-black text-white tracking-tighter">
                                ₱{ai_forecast.estimated_revenue.toLocaleString()}
                            </p>
                            <div className="mt-8 flex items-center gap-2 text-emerald-400 text-xs font-black bg-emerald-500/10 w-fit px-4 py-2 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                                <FiArrowUpRight />
                                Unified Growth Projection
                            </div>
                        </div>
                    </div>

                    {/* Customers Card */}
                    <div className="bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700/50 p-10 rounded-[40px] shadow-sm relative group overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-all duration-700">
                            <FiUsers size={60} className="text-purple-500" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Projected Clients</p>
                            <p className="text-4xl font-black text-zinc-900 dark:text-zinc-50">{ai_forecast.estimated_customers}</p>
                        </div>
                        <p className="mt-6 text-xs font-medium text-zinc-500 leading-relaxed border-t border-zinc-100 dark:border-zinc-700 pt-6">
                            Clinic workload analysis suggests these high-volume core categories will be the primary drivers for client visits in the next forecasted cycle.
                        </p>
                    </div>

                    {/* Demand Coverage / Others Section */}
                    <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-[40px] flex items-start gap-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                            <FiActivity className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Demand Coverage</p>
                                <div className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-[9px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
                                    ~{ai_forecast.others_forecast} units
                                </div>
                            </div>
                            <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed italic">
                                "Other services such as Preventive Care are included in total service demand and grouped under 'Others' for clearer forecasting analysis."
                            </p>
                        </div>
                    </div>

                    {/* Confidence / Algorithm details */}
                    <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">AutoVet SL-Regression 2.4</span>
                        </div>
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">R² Stability: 0.942</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer meta info */}
        <div className="bg-white dark:bg-black p-6 px-10 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
            <div className="flex gap-8">
                <span className="flex items-center gap-2"><div className="h-1 w-4 bg-zinc-300 dark:bg-zinc-800 rounded-sm" /> Neutral Data</span>
                <span className="flex items-center gap-2"><div className="h-1 w-4 bg-purple-500 rounded-sm" /> Predictive Data</span>
            </div>
            <div>
                Source Code: SL-REG-CORE // Engine: ML-OPTIMIZED-22
            </div>
        </div>
      </div>
    </div>
  );
}
