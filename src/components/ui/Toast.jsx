import { FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo, FiX } from "react-icons/fi";

const typeStyles = {
    success: {
        icon: FiCheckCircle,
        iconColor: "text-emerald-500 dark:text-emerald-400",
        bg: "bg-white dark:bg-zinc-800",
        border: "border-emerald-200 dark:border-emerald-900/50",
    },
    error: {
        icon: FiAlertCircle,
        iconColor: "text-red-500 dark:text-red-400",
        bg: "bg-white dark:bg-zinc-800",
        border: "border-red-200 dark:border-red-900/50",
    },
    warning: {
        icon: FiAlertTriangle,
        iconColor: "text-amber-500 dark:text-amber-400",
        bg: "bg-white dark:bg-zinc-800",
        border: "border-amber-200 dark:border-amber-900/50",
    },
    info: {
        icon: FiInfo,
        iconColor: "text-blue-500 dark:text-blue-400",
        bg: "bg-white dark:bg-zinc-800",
        border: "border-blue-200 dark:border-blue-900/50",
    },
};

export default function Toast({ message, type = "info", onClose, isExiting }) {
    const { icon: Icon, iconColor, bg, border } = typeStyles[type] || typeStyles.info;
    const animationClass = isExiting ? "animate-slide-out-right" : "animate-slide-in-right";

    return (
        <div
            className={`flex w-full items-start gap-4 rounded-xl border p-4 shadow-lg drop-shadow-sm transition-all duration-300 ${bg} ${border} ${animationClass}`}
            role="alert"
        >
            <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${iconColor}`} />
            <div className="flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-100 leading-snug">
                    {message}
                </p>
            </div>
            <button
                onClick={onClose}
                className="inline-flex flex-shrink-0 rounded-lg p-1 -mr-2 -mt-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 transition-colors duration-200"
                aria-label="Close"
            >
                <FiX className="h-4 w-4" />
            </button>
        </div>
    );
}
