import { useState } from "react";
import { FiAlertTriangle, FiX, FiSend, FiChevronDown } from "react-icons/fi";
import clsx from "clsx";
import api from "../../api";
import { useToast } from "../../context/ToastContext";

const TEMPLATES = [
  {
    id: "inappropriate_name",
    label: "Inappropriate Name",
    subject: "⚠️ Account Name Policy Violation",
    message:
      "Dear {owner_name},\n\nWe noticed that your account name contains inappropriate or invalid content. Please update your name to reflect your real, full name as this is required for proper identification and medical records.\n\nFailure to update your name may result in restricted access to our services.\n\nThank you for your cooperation.\n\n— Pet Wellness Animal Clinic",
  },
  {
    id: "inappropriate_image",
    label: "Inappropriate Image",
    subject: "⚠️ Profile Image Policy Violation",
    message:
      "Dear {owner_name},\n\nWe have detected that your profile or pet image contains inappropriate content that violates our community guidelines. Please replace it with a suitable, appropriate image at your earliest convenience.\n\nContinued violation of our image policy may result in restricted access.\n\nThank you for your understanding.\n\n— Pet Wellness Animal Clinic",
  },
  {
    id: "unverified_email",
    label: "Unverified / Invalid Email",
    subject: "⚠️ Email Address Verification Required",
    message:
      "Dear {owner_name},\n\nYour registered email address appears to be invalid or unverifiable. A valid, active email address is required to receive important updates, appointment reminders, and invoices from our clinic.\n\nPlease log in and update your email address as soon as possible.\n\nThank you.\n\n— Pet Wellness Animal Clinic",
  },
  {
    id: "unverified_number",
    label: "Unverified / Invalid Contact Number",
    subject: "⚠️ Contact Number Verification Required",
    message:
      "Dear {owner_name},\n\nThe contact number on your account could not be verified. Please ensure it is a valid, active Philippine mobile number (11 digits starting with 09).\n\nUpdate your contact details by logging into the portal.\n\nThank you.\n\n— Pet Wellness Animal Clinic",
  },
  {
    id: "suspicious_activity",
    label: "Suspicious Account Activity",
    subject: "⚠️ Suspicious Activity Detected on Your Account",
    message:
      "Dear {owner_name},\n\nWe have detected unusual activity on your account. If this was not you, please change your password immediately and contact our clinic.\n\nYour account security is important to us.\n\n— Pet Wellness Animal Clinic",
  },
  {
    id: "custom",
    label: "Custom Message",
    subject: "",
    message: "",
  },
];

export default function WarnUserModal({ owner, onClose, onSent }) {
  const toast = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [subject, setSubject]   = useState(TEMPLATES[0].subject);
  const [message, setMessage]   = useState(
    TEMPLATES[0].message.replace("{owner_name}", owner?.name || "")
  );
  const [sending, setSending]   = useState(false);

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setSubject(tpl.subject);
    setMessage(tpl.message.replace("{owner_name}", owner?.name || ""));
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required.");
      return;
    }
    setSending(true);
    try {
      await api.post(`/api/owners/${owner.id}/warn`, { subject, message });
      toast.success(`Warning sent to ${owner.name} via email.`);
      onSent?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send warning.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-dark-card rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-7 py-5 border-b border-zinc-100 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <FiAlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-zinc-800 dark:text-zinc-100">Send Warning</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">to {owner?.name} · {owner?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors">
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-7 py-6 space-y-5">

          {/* Template selector */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2">
              Warning Template
            </label>
            <div className="relative">
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full appearance-none rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-surface text-sm font-semibold text-zinc-800 dark:text-zinc-200 px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 h-4 w-4" />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-zinc-800 dark:text-zinc-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all"
              placeholder="Warning subject..."
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={9}
              className="w-full rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-zinc-800 dark:text-zinc-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all resize-none leading-relaxed"
              placeholder="Type your warning message..."
            />
          </div>

          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            This warning will be sent to <span className="font-bold text-zinc-600 dark:text-zinc-300">{owner?.email}</span> via email and will appear as a popup the next time the user logs in.
          </p>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-7 py-5 border-t border-zinc-100 dark:border-dark-border">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-dark-surface transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className={clsx(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all active:scale-95",
              sending
                ? "bg-amber-300 cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20"
            )}
          >
            <FiSend className="h-4 w-4" />
            {sending ? "Sending…" : "Send Warning"}
          </button>
        </div>
      </div>
    </div>
  );
}
