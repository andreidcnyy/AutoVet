import * as FiIcons from "react-icons/fi";
import clsx from "clsx";
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Simple SVG-based Line Chart component.
 * Prevents NaN points and division by zero.
 */
function SimpleLineChart({ data, width = 600, height = 200, color = "#10b981", dataKey = "total" }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="h-[200px] flex items-center justify-center text-zinc-400">No data available</div>;
  }

  const padding = 20;
  const values = data.map(d => Number(d[dataKey] || 0));
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = (max - min) || 1;

  const points = data.map((d, i) => {
    const x = padding + (i * (width - 2 * padding) / (data.length > 1 ? data.length - 1 : 1));
    const y = height - padding - ((values[i] - min) / range * (height - 2 * padding));
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => {
          const x = padding + (i * (width - 2 * padding) / (data.length > 1 ? data.length - 1 : 1));
          const y = height - padding - ((values[i] - min) / range * (height - 2 * padding));
          return (
            <circle key={i} cx={x} cy={y} r="4" fill={color} className="cursor-pointer transition-all hover:r-6" />
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Simple SVG-based Bar Chart component.
 * Prevents division by zero.
 */
function SimpleBarChart({ data, width = 600, height = 250, color = "#6366f1" }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="h-[250px] flex items-center justify-center text-zinc-400">No data available</div>;
  }

  const padding = 40;
  const dataValues = data.map(d => Number(d.total_revenue || d.value || 0));
  const maxValue = Math.max(...dataValues, 1);
  const barGap = 10;
  const barWidth = Math.max((width - 2 * padding) / data.length - barGap, 5);

  return (
    <div className="w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" preserveAspectRatio="none">
        {data.map((d, i) => {
          const val = Number(d.total_revenue || d.value || 0);
          const barHeight = (val / maxValue) * (height - 2 * padding);
          const x = padding + i * (barWidth + barGap);
          const y = height - padding - barHeight;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx="4" />
              <text
                x={x + barWidth / 2}
                y={height - 15}
                textAnchor="middle"
                fontSize="10"
                className="fill-zinc-500 dark:fill-zinc-400"
              >
                {String(d.item_name || d.name || "").substring(0, 10)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ReportsPage() {
  const [activeTab, setActiveTab] = useState("Sales");
  const [salesData, setSalesData] = useState({ revenue: [], topServices: [], volume: [] });
  const [patientData, setPatientData] = useState({ species: [], trends: [], demographics: {} });
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.token) return;
    let isMounted = true;
    setIsLoading(true);

    const fetchData = async () => {
      const headers = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${user.token}`
      };
      try {
        if (activeTab === "Sales") {
          const [revenue, topServices, volume] = await Promise.all([
            fetch("/api/reports/sales/revenue-summary", { headers }).then(r => r.json()),
            fetch("/api/reports/sales/top-services", { headers }).then(r => r.json()),
            fetch("/api/reports/sales/transaction-volume", { headers }).then(r => r.json())
          ]);
          if (isMounted) setSalesData({ revenue, topServices, volume });
        } else if (activeTab === "Patients") {
          const [species, trends, demographics] = await Promise.all([
            fetch("/api/reports/patients/species-distribution", { headers }).then(r => r.json()),
            fetch("/api/reports/patients/registration-trends", { headers }).then(r => r.json()),
            fetch("/api/reports/patients/demographics", { headers }).then(r => r.json())
          ]);
          if (isMounted) setPatientData({ species, trends, demographics });
        }
      } catch (error) {
        console.error("Reports data fetch failed:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => { isMounted = false; };
  }, [activeTab, user?.token]);

  const tabs = [
    { name: "Sales", icon: FiIcons.FiTrendingUp },
    { name: "Patients", icon: FiIcons.FiPieChart },
    { name: "Inventory", icon: FiIcons.FiClipboard },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Advanced Reports</h2>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">Analyze clinic data, revenue, and patient demographics.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
          <FiIcons.FiDownload className="w-4 h-4" />
          Export All Data
        </button>
      </div>

      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={clsx(
              "flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all border-b-2 hover:bg-zinc-50 dark:hover:bg-zinc-900",
              activeTab === tab.name
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 dark:text-zinc-500"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-zinc-500">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            <span>Loading Report Data...</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeTab === "Sales" && (
            <>
              <div className="card-shell p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <FiIcons.FiTrendingUp className="text-emerald-500" /> Revenue Trend (Last 30 Days)
                </h3>
                <SimpleLineChart data={salesData.revenue} color="#10b981" />
              </div>
              <div className="card-shell p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <FiIcons.FiBarChart2 className="text-indigo-500" /> Top Services by Revenue
                </h3>
                <SimpleBarChart data={salesData.topServices} color="#6366f1" />
              </div>
              <div className="card-shell p-6 col-span-full">
                <h3 className="text-lg font-bold mb-4">Transaction Volume</h3>
                <SimpleLineChart data={salesData.volume} dataKey="count" color="#f59e0b" />
              </div>
            </>
          )}

          {activeTab === "Patients" && (
            <>
              <div className="card-shell p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <FiIcons.FiPieChart className="text-emerald-500" /> Species Distribution
                </h3>
                <SimpleBarChart data={patientData.species} color="#3b82f6" />
              </div>
              <div className="card-shell p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <FiIcons.FiTrendingUp className="text-emerald-500" /> Registration Growth
                </h3>
                <SimpleLineChart data={patientData.trends} dataKey="total" color="#10b981" />
              </div>
            </>
          )}

          {activeTab === "Inventory" && (
            <div className="card-shell p-6 col-span-full bg-zinc-50 dark:bg-dark-surface border-dashed border-2 border-zinc-200 dark:border-dark-border">
              <div className="flex flex-col items-center text-center py-10">
                <FiIcons.FiBox className="w-12 h-12 text-zinc-300 mb-4" />
                <h3 className="text-lg font-bold mb-2">Inventory Status Summary</h3>
                <p className="max-w-md text-zinc-500 dark:text-zinc-400">Inventory reporting is integrated with our real-time stock monitoring system.</p>
                <button
                  onClick={() => window.location.href = '/inventory'}
                  className="mt-6 flex items-center gap-2 text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
                >
                  Go to Inventory Management <FiIcons.FiArrowRight />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportsPage;
