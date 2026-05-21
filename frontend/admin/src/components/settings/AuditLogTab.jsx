import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FiActivity, FiSearch, FiX, FiChevronRight } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import api from "../../api";
import clsx from "clsx";

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// Fields that are internal/technical — never show to users
const isHidden = (key) =>
  key.endsWith("_id") ||
  key.endsWith("_token") ||
  [
    "id", "uuid", "created_at", "updated_at", "deleted_at",
    "email_verified_at", "password", "two_factor_secret",
    "two_factor_recovery_codes", "remember_token",
  ].includes(key);

// Human-readable labels for common field names
const FIELD_LABELS = {
  name: "Name", first_name: "First Name", last_name: "Last Name",
  email: "Email Address", phone: "Phone", phone_number: "Phone",
  status: "Status", role: "Role", price: "Price", amount: "Amount",
  total: "Total", description: "Description", notes: "Notes",
  address: "Address", date_of_birth: "Date of Birth", birth_date: "Date of Birth",
  gender: "Gender", weight: "Weight", color: "Color / Markings",
  is_active: "Active", is_neutered: "Neutered / Spayed",
  title: "Title", subject: "Subject", message: "Message",
  body: "Content", category: "Category", type: "Type",
  quantity: "Quantity", unit: "Unit", invoice_number: "Invoice Number",
  due_date: "Due Date", appointment_date: "Appointment Date",
  appointment_time: "Appointment Time", reason: "Reason",
  diagnosis: "Diagnosis", treatment: "Treatment",
  prescription: "Prescription", lot_number: "Lot / Batch Number",
  expiry_date: "Expiry Date", reorder_point: "Reorder Point",
  requires_doctor: "Requires Doctor", pricing_mode: "Pricing Mode",
  item_name: "Item Name", start_time: "Start Time", end_time: "End Time",
  date: "Date", content: "Content", target: "Target Audience",
  is_published: "Published", is_read: "Read",
  shelf_life_days: "Shelf Life (Days)", manufacturer: "Manufacturer",
  supplier: "Supplier", service_name: "Service",
};

// Human-readable record type names
const MODEL_LABELS = {
  Appointment: "Appointment", Invoice: "Invoice", Pet: "Pet Profile",
  User: "Staff Account", PortalUser: "Client Account", Service: "Service",
  Inventory: "Inventory Item", InventoryItem: "Inventory Item",
  MedicalRecord: "Medical Record", Notification: "Notification",
  SystemAnnouncement: "Announcement", Setting: "System Setting",
  Breed: "Breed", Species: "Species",
};

const friendlyModel = (type) => {
  if (!type) return "Record";
  const raw = type.split("\\").pop();
  return MODEL_LABELS[raw] || raw;
};

const friendlyField = (key) =>
  FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Format a raw value into something readable
const formatValue = (val) => {
  if (val === null || val === undefined || val === "") return null;
  if (val === true  || val === 1  || val === "1"  || val === "true")  return "Yes";
  if (val === false || val === 0  || val === "0"  || val === "false") return "No";
  if (typeof val === "object") return null; // hide complex objects
  const str = String(val);
  if (/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(str)) {
    try {
      return new Date(str).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
    } catch (_) {}
  }
  return str;
};

const extractLabel = (values) => {
  if (!values) return null;
  const raw = values.name || values.title || values.invoice_number || values.item_name || values.subject || values.email || null;
  if (raw) return raw;
  // Settings store their identity in a "key" field (e.g. "maintenance_mode")
  if (values.key) return friendlyField(values.key);
  return null;
};

// Plain-English one-line summary for the table row
const buildSummary = (log) => {
  const model = friendlyModel(log.model_type);
  const vals = log.action === "deleted" ? log.old_values : log.new_values;
  const label = extractLabel(vals);

  if (log.action === "created") {
    return label ? `Added a new ${model}: "${label}"` : `Added a new ${model}`;
  }
  if (log.action === "deleted") {
    return label ? `Removed ${model}: "${label}"` : `Removed a ${model}`;
  }
  if (log.action === "updated" && log.old_values && log.new_values) {
    const changed = Object.keys(log.new_values).filter(
      (k) => !isHidden(k) && JSON.stringify(log.old_values[k]) !== JSON.stringify(log.new_values[k])
    );
    if (changed.includes("status")) {
      const from = formatValue(log.old_values.status) ?? log.old_values.status;
      const to   = formatValue(log.new_values.status) ?? log.new_values.status;
      return label
        ? `"${label}" status changed from ${from} to ${to}`
        : `${model} status changed from ${from} to ${to}`;
    }
    const count = changed.length;
    return label
      ? `Updated "${label}" — ${count} detail${count !== 1 ? "s" : ""} changed`
      : `Updated ${model} — ${count} detail${count !== 1 ? "s" : ""} changed`;
  }
  return label ? `${capitalize(log.action)} "${label}"` : `${capitalize(log.action)} a ${model}`;
};

// User-friendly detail modal — no raw field names or JSON shown
function DetailModal({ log, onClose }) {
  const model = friendlyModel(log.model_type);
  const label = extractLabel(log.action === "deleted" ? log.old_values : log.new_values);
  const title = label ? `"${label}"` : `${model}`;

  // For updated: only show fields that actually changed
  const changedFields = log.action === "updated" && log.old_values && log.new_values
    ? Object.keys(log.new_values).filter(
        (k) => !isHidden(k) && JSON.stringify(log.old_values[k]) !== JSON.stringify(log.new_values[k])
      )
    : [];

  // For created / deleted: show visible fields from the snapshot
  const snapshotValues = log.action === "deleted" ? log.old_values : log.new_values;
  const snapshotFields = snapshotValues
    ? Object.keys(snapshotValues).filter((k) => !isHidden(k) && formatValue(snapshotValues[k]) !== null)
    : [];

  const actionMeta = {
    created: { label: "New Record Added",  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800" },
    updated: { label: "Record Updated",    color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800" },
    deleted: { label: "Record Removed",    color: "text-rose-600 dark:text-rose-400",     bg: "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800" },
  }[log.action] ?? { label: capitalize(log.action), color: "text-zinc-500", bg: "bg-zinc-50 border-zinc-100" };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-dark-card rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface">
          <div className="space-y-0.5">
            <p className={clsx("text-[10px] font-black uppercase tracking-widest", actionMeta.color)}>
              {actionMeta.label}
            </p>
            <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100 leading-tight">
              {model} · {title}
            </h3>
            <p className="text-xs text-zinc-400">
              {new Date(log.created_at).toLocaleString("en-PH", {
                month: "long", day: "numeric", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
              {log.user?.name && (
                <> &nbsp;·&nbsp; <span className="font-semibold text-zinc-600 dark:text-zinc-300">by {log.user.name}</span></>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-dark-border transition-colors text-zinc-400">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">

          {/* UPDATED: show before → after for each changed field */}
          {log.action === "updated" && (
            changedFields.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-8">No visible changes recorded.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">What changed</p>
                {changedFields.map((key) => {
                  const before = formatValue(log.old_values[key]) ?? "Not set";
                  const after  = formatValue(log.new_values[key]) ?? "Not set";
                  return (
                    <div key={key} className={clsx("rounded-xl border p-3 space-y-1.5", actionMeta.bg)}>
                      <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        {friendlyField(key)}
                      </p>
                      <div className="flex items-start gap-3 text-sm flex-wrap">
                        <span className="line-through text-zinc-400 dark:text-zinc-500 break-all">{before}</span>
                        <span className="text-zinc-400">→</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-100 break-all">{after}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* CREATED / DELETED: show a summary of the record */}
          {(log.action === "created" || log.action === "deleted") && (
            snapshotFields.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-8">No details recorded.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
                  {log.action === "created" ? "Record details" : "Removed record details"}
                </p>
                <div className={clsx("rounded-xl border divide-y dark:divide-dark-border overflow-hidden", actionMeta.bg)}>
                  {snapshotFields.map((key) => {
                    const val = formatValue(snapshotValues[key]);
                    if (!val) return null;
                    return (
                      <div key={key} className="flex items-start justify-between gap-4 px-4 py-2.5">
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {friendlyField(key)}
                        </span>
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100 text-right break-all">
                          {val}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function AuditLogTab() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 20,
  });
  const [filters, setFilters] = useState({
    action_type: "",
    model_type: "",
    user_id: "",
    date_from: "",
    date_to: "",
  });

  const AUDIT_CACHE_KEY = "settings_audit_logs_cache";
  const AUDIT_CACHE_TTL = 5 * 60 * 1000;

  useEffect(() => {
    api.get("/users").then((data) => {
      if (Array.isArray(data)) setUsers(data);
    }).catch(() => {});
  }, []);

  const isDefaultView = (page, f) =>
    page === 1 && !f.action_type && !f.model_type && !f.user_id && !f.date_from && !f.date_to;

  const applyResponse = (data) => {
    if (!data) return;
    setLogs(data.data || []);
    setPagination({
      current_page: data.current_page || 1,
      last_page: data.last_page || 1,
      total: data.total || 0,
      per_page: data.per_page || 20,
    });
  };

  const controllerRef = React.useRef(null);

  const fetchLogs = async (page = 1) => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (isDefaultView(page, filters)) {
      try {
        const cached = JSON.parse(localStorage.getItem(AUDIT_CACHE_KEY) || "null");
        if (cached && Date.now() - cached.ts < AUDIT_CACHE_TTL && cached.data) {
          applyResponse(cached.data);
          setLoading(false);
        } else {
          setLoading(true);
        }
      } catch (_) {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }

    try {
      const response = await api.get("/audit-logs", {
        params: { ...filters, page },
        signal: controller.signal,
      });
      applyResponse(response);
      if (isDefaultView(page, filters)) {
        try { localStorage.setItem(AUDIT_CACHE_KEY, JSON.stringify({ data: response, ts: Date.now() })); } catch (_) {}
      }
    } catch (err) {
      if (err.name === "AbortError" || err.code === "ERR_CANCELED") return;
      console.error("AuditLogTab Error:", err);
      toast.error(err.message || "Failed to fetch audit logs");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
    return () => { if (controllerRef.current) controllerRef.current.abort(); };
  }, [filters]);

  const handlePageChange = (page) => {
    fetchLogs(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const actionColors = {
    created: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200",
    updated: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200",
    deleted: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200",
  };

  const Pagination = ({ compact = false }) =>
    pagination.last_page <= 1 ? null : (
      <div className={clsx(
        "flex items-center justify-between border border-zinc-200 bg-zinc-50/50 px-6 py-3 dark:border-dark-border dark:bg-dark-surface/30 rounded-xl",
        compact ? "mb-4" : "mt-2"
      )}>
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          {(pagination.current_page - 1) * pagination.per_page + 1}–
          {Math.min(pagination.current_page * pagination.per_page, pagination.total)}{" "}
          of {pagination.total}
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => handlePageChange(pagination.current_page - 1)} disabled={pagination.current_page === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 disabled:opacity-40 dark:border-dark-border dark:bg-dark-card">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          {[...Array(Math.min(5, pagination.last_page))].map((_, i) => {
            let p;
            if (pagination.last_page <= 5) p = i + 1;
            else if (pagination.current_page <= 3) p = i + 1;
            else if (pagination.current_page >= pagination.last_page - 2) p = pagination.last_page - 4 + i;
            else p = pagination.current_page - 2 + i;
            return (
              <button key={p} onClick={() => handlePageChange(p)}
                className={clsx("flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black transition-all",
                  pagination.current_page === p
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                    : "border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:bg-dark-card")}>
                {p}
              </button>
            );
          })}
          <button onClick={() => handlePageChange(pagination.current_page + 1)} disabled={pagination.current_page === pagination.last_page}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 disabled:opacity-40 dark:border-dark-border dark:bg-dark-card">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    );

  return (
    <div className="card-shell flex min-h-[600px] flex-col">
      {/* Header */}
      <div className="border-b border-zinc-200 px-6 py-5 dark:border-dark-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
            <FiActivity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">System Audit Logs</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Detailed record of every action taken in the system</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 border-b border-zinc-200 bg-zinc-50/50 p-5 sm:grid-cols-5 dark:border-dark-border dark:bg-dark-surface/50">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">User</label>
          <select
            value={filters.user_id}
            onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200"
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        {[
          { label: "Model / Target", key: "model_type", type: "text", placeholder: "e.g. Invoice, Pet" },
          { label: "Date From", key: "date_from", type: "date" },
          { label: "Date To", key: "date_to", type: "date" },
        ].map(({ label, key, type, placeholder }) => (
          <div key={key}>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</label>
            <input
              type={type}
              placeholder={placeholder}
              value={filters[key]}
              onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200"
            />
          </div>
        ))}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Action</label>
          <select
            value={filters.action_type}
            onChange={(e) => setFilters({ ...filters, action_type: e.target.value })}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200"
          >
            <option value="">All Actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto p-5">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-zinc-500">Loading logs…</div>
        ) : logs.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-zinc-500">
            <FiSearch className="mb-2 h-6 w-6 text-zinc-300" />
            <p>No audit logs found matching your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Pagination compact />

            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-dark-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500 dark:bg-dark-surface dark:text-zinc-400 border-b border-zinc-200 dark:border-dark-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Timestamp</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Target</th>
                    <th className="px-4 py-3 font-semibold">What happened</th>
                    <th className="px-4 py-3 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white dark:divide-dark-border dark:bg-dark-card">
                  {logs.map((log) => {
                    const summary = buildSummary(log);
                    const hasData = log.old_values || log.new_values;
                    return (
                      <tr key={log.id} className="transition hover:bg-zinc-50 dark:hover:bg-dark-surface/50">
                        <td className="px-4 py-3 text-zinc-400 dark:text-zinc-500 whitespace-nowrap text-xs">
                          <div className="font-semibold text-zinc-600 dark:text-zinc-300">
                            {new Date(log.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          <div className="text-zinc-400">
                            {new Date(log.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
                          {log.user?.name ?? <span className="text-zinc-400 font-normal italic">System</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={clsx(
                            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold capitalize",
                            actionColors[log.action] ?? "bg-zinc-100 text-zinc-800 border-zinc-200"
                          )}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(() => {
                            const vals = log.action === "deleted" ? log.old_values : log.new_values;
                            const lbl = extractLabel(vals);
                            return (
                              <>
                                <span className="font-semibold text-zinc-700 dark:text-zinc-200">{friendlyModel(log.model_type)}</span>
                                {lbl && <p className="text-xs text-zinc-400 mt-0.5 max-w-[140px] truncate">{lbl}</p>}
                              </>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed line-clamp-2">{summary}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {hasData && (
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-dark-border px-2.5 py-1 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors"
                            >
                              View <FiChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination />
          </div>
        )}
      </div>

      {selectedLog && <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}

export default AuditLogTab;
