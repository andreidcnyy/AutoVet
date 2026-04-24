import { useState } from "react";
import { FiUpload, FiFileText, FiCalendar, FiPackage, FiUser, FiInfo, FiCheckCircle, FiAlertCircle, FiLoader, FiBriefcase } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import clsx from "clsx";

const importOptions = [
    {
        id: "owners",
        label: "Owners",
        icon: FiUser,
        endpoint: "/api/import/owners",
        fields: "name, phone, email",
        description: "Standardize client list before importing pets."
    },
    {
        id: "appointments",
        label: "Appointments",
        icon: FiCalendar,
        endpoint: "/api/import/appointments",
        fields: "pet_id, service_id, date, status",
        description: "Upload historical visit patterns to train the AI."
    },
    {
        id: "invoices",
        label: "Revenue/Invoices",
        icon: FiFileText,
        endpoint: "/api/import/invoices",
        fields: "pet_id, total, status, created_at",
        description: "Essential for financial and demand forecasting."
    },
    {
        id: "inventory_usage",
        label: "Inventory History",
        icon: FiPackage,
        endpoint: "/api/import/inventory-usage",
        fields: "inventory_id, quantity, transaction_type, created_at",
        description: "Helps AI learn stock depletion curves."
    },
    {
        id: "services",
        label: "Services",
        icon: FiBriefcase, // We use FiBriefcase or similar if not found
        endpoint: "/api/import/services",
        fields: "name, category, price, status",
        description: "Bulk upload your clinic's service catalog."
    }
];

// Fallback for FiBriefcase if it's missing from import
const FiBriefcaseIcon = FiPackage; 

export default function DataImportTab() {
    const { user } = useAuth();
    const toast = useToast();
    const [selectedOption, setSelectedOption] = useState(importOptions[0]);
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error("Please select a CSV file first.");
            return;
        }

        setIsUploading(true);
        setResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(selectedOption.endpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${user?.token}`,
                    "Accept": "application/json"
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                setResult({
                    success: true,
                    message: data.message,
                    warnings: data.warnings || []
                });
                toast.success(data.message);
                setFile(null);
                // Reset file input
                document.getElementById("csv-upload").value = "";
            } else {
                setResult({
                    success: false,
                    message: data.message || "Import failed.",
                    errors: data.errors || []
                });
                toast.error(data.message || "Import failed.");
            }
        } catch (err) {
            console.error(err);
            toast.error("A network error occurred.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card-shell p-6 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white relative overflow-hidden">
                <LuSparkles className="absolute -top-6 -right-6 w-32 h-32 opacity-10 rotate-12" />
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <FiUpload className="text-emerald-400" />
                        Historical Data Import
                    </h2>
                    <p className="mt-1 text-zinc-400 text-sm max-w-lg">
                        Accelerate your AI learning progress by uploading existing clinical data. 
                        CSV format required with specific headers.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Selector */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">1. Select Data Type</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {importOptions.map((opt) => {
                            const Icon = opt.icon;
                            const active = selectedOption.id === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        setSelectedOption(opt);
                                        setResult(null);
                                    }}
                                    className={clsx(
                                        "flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-200",
                                        active 
                                            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 ring-2 ring-emerald-500/20 shadow-sm" 
                                            : "border-zinc-100 bg-white hover:bg-zinc-50 dark:border-dark-border dark:bg-dark-card"
                                    )}
                                >
                                    <div className={clsx(
                                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                                        active ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-dark-surface"
                                    )}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className={clsx("font-bold text-sm", active ? "text-emerald-900 dark:text-emerald-400" : "text-zinc-800 dark:text-zinc-200")}>
                                            {opt.label}
                                        </h4>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-500 line-clamp-1">{opt.description}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Upload Area */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">2. Upload CSV File</h3>
                    <div className="card-shell p-6 space-y-6">
                        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                            <div className="flex gap-3">
                                <FiInfo className="h-5 w-5 text-blue-600 shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold text-blue-900 dark:text-blue-400">Required CSV Headers</h5>
                                    <code className="block mt-1 text-xs font-mono text-blue-700 dark:text-blue-300 break-all">
                                        {selectedOption.fields}
                                    </code>
                                </div>
                            </div>
                        </div>

                        <div className="relative group">
                            <input 
                                type="file" 
                                id="csv-upload"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={isUploading}
                            />
                            <div className={clsx(
                                "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors",
                                file ? "border-emerald-400 bg-emerald-50/20" : "border-zinc-200 group-hover:border-emerald-300 bg-zinc-50/50 dark:border-dark-border dark:bg-dark-surface/50"
                            )}>
                                <FiUpload className={clsx("h-10 w-10 mb-3", file ? "text-emerald-500" : "text-zinc-300")} />
                                {file ? (
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{file.name}</p>
                                        <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Click or drag CSV here</p>
                                        <p className="text-xs text-zinc-500 text-zinc-400">Supported format: .csv only</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleUpload}
                            disabled={!file || isUploading}
                            className={clsx(
                                "w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                                !file || isUploading
                                    ? "bg-zinc-100 text-zinc-400 dark:bg-dark-surface cursor-not-allowed"
                                    : "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700"
                            )}
                        >
                            {isUploading ? (
                                <>
                                    <FiLoader className="h-4 w-4 animate-spin" />
                                    Processing Import...
                                </>
                            ) : (
                                <>
                                    <FiCheckCircle className="h-4 w-4" />
                                    Begin Import
                                </>
                            )}
                        </button>
                    </div>

                    {/* Results Feedback */}
                    {result && (
                        <div className={clsx(
                            "p-4 rounded-2xl border flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300",
                            result.success 
                                ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30" 
                                : "bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30"
                        )}>
                            <div className="flex items-start gap-3">
                                {result.success ? (
                                    <FiCheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                    <FiAlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                                )}
                                <div>
                                    <h4 className={clsx("text-sm font-bold", result.success ? "text-emerald-900 dark:text-emerald-400" : "text-rose-900 dark:text-rose-400")}>
                                        {result.success ? "Import Completed" : "Import Failed"}
                                    </h4>
                                    <p className={clsx("text-xs mt-1 font-medium", result.success ? "text-emerald-700 dark:text-emerald-500" : "text-rose-700 dark:text-rose-500")}>
                                        {result.message}
                                    </p>
                                </div>
                            </div>
                            
                            {(result.warnings?.length > 0 || result.errors?.length > 0) && (
                                <div className="mt-2 bg-white/50 dark:bg-dark-card/50 rounded-xl p-3 border border-zinc-100 dark:border-dark-border">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                                        {result.success ? "Warnings" : "Validation Errors"}
                                    </p>
                                    <ul className="space-y-1">
                                        {(result.success ? result.warnings : result.errors).map((msg, i) => (
                                            <li key={i} className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                                                • {msg}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
