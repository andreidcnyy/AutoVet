import { useEffect, useState } from "react";
import clsx from "clsx";
import { FiX } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";

export default function AiForecastToast({ data, isExiting, onClose }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger enter animation on mount
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    // Provide default fallback values if the structure is missing
    const itemName = data?.item_name || "Inventory Item";
    const status = data?.status || "Update";
    const days = data?.days;
    const weeklySales = data?.predicted_weekly_sales || 0;
    
    // Status color mapping
    const statusTheme = {
        "Critical": "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900",
        "Reorder Soon": "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900",
        "Safe": "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900",
    }[status] || "bg-zinc-50 border-zinc-200 dark:bg-dark-surface dark:border-dark-border";
    
    const iconTheme = {
        "Critical": "text-rose-500",
        "Reorder Soon": "text-amber-500",
        "Safe": "text-emerald-500",
    }[status] || "text-zinc-500";

    return (
        <div
            className={clsx(
                "relative overflow-hidden rounded-xl border p-4 shadow-lg backdrop-blur-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col gap-2",
                statusTheme,
                isVisible && !isExiting ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            )}
        >
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <LuSparkles className={`w-24 h-24 ${iconTheme}`} />
            </div>

            <div className="flex items-start justify-between z-10">
                <div className="flex items-center gap-2">
                    <LuSparkles className={`w-5 h-5 shrink-0 ${iconTheme} animate-pulse`} />
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        AI Forecast Update
                    </h4>
                </div>
                <button
                    onClick={onClose}
                    className="shrink-0 rounded-lg p-1 text-zinc-400 opacity-70 transition-opacity hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
                >
                    <FiX className="h-4 w-4" />
                </button>
            </div>
            
            <div className="z-10 ml-7 space-y-2">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    {itemName} <span className="opacity-60 font-normal">analysis completed</span>
                </p>
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="rounded border border-black/5 bg-white/50 p-2 dark:border-white/5 dark:bg-black/20">
                        <p className="text-[9px] uppercase tracking-wider font-bold text-zinc-500">Prediction</p>
                        <p className={`text-xs font-black ${iconTheme}`}>{status}</p>
                    </div>
                    {days !== null && days !== undefined && (
                        <div className="rounded border border-black/5 bg-white/50 p-2 dark:border-white/5 dark:bg-black/20">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-zinc-500">Est. Stockout</p>
                            <p className="text-xs font-black text-rose-600 dark:text-rose-400">{days} days</p>
                        </div>
                    )}
                </div>

                {weeklySales > 0 && (
                     <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-500 mt-1">
                        Est. Weekly Usage: {weeklySales.toLocaleString()} units
                     </p>
                )}
            </div>
            
             {/* Progress bar effect simulating the timeout */}
             <div className="absolute bottom-0 left-0 h-1 w-full bg-black/5 dark:bg-white/5">
                <div className="h-full w-full bg-emerald-500/50 origin-left animate-[shrink_5s_linear_forwards]" />
            </div>
        </div>
    );
}
