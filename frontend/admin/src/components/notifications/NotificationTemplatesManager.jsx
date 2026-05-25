import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';
import { FiPlus, FiEdit2, FiTrash2, FiMail, FiMessageSquare, FiBell } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

/* Maps raw event_key values to plain-English labels */
const EVENT_OPTIONS = [
  { value: '',                        label: 'Send manually (not automatic)' },
  { value: 'appointment_confirmed',   label: 'When an appointment is approved' },
  { value: 'appointment_declined',    label: 'When an appointment is declined' },
  { value: 'appointment_cancelled',   label: 'When an appointment is cancelled' },
  { value: 'appointment_reminder',    label: 'Before an appointment (reminder)' },
  { value: 'appointment_completed',   label: 'After a visit is completed' },
  { value: 'invoice_created',         label: 'When a billing invoice is created' },
];

function eventLabel(key) {
  return EVENT_OPTIONS.find(o => o.value === key)?.label || key || 'Manual';
}

/* Plain-English descriptions for template variables */
const VARIABLE_HINTS = [
  { tag: '{owner_name}',    desc: "Client's full name" },
  { tag: '{pet_name}',      desc: "Pet's name" },
  { tag: '{patient}',       desc: "Pet's name (alternative)" },
  { tag: '{date}',          desc: 'Appointment date' },
  { tag: '{time}',          desc: 'Appointment time' },
  { tag: '{date_scheduled}',desc: 'Scheduled date' },
  { tag: '{arrival_time}',  desc: 'Expected arrival time' },
  { tag: '{findings}',      desc: "Doctor's clinical findings" },
  { tag: '{diagnosis}',     desc: "Doctor's diagnosis" },
];

export default function NotificationTemplatesManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);

  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!user?.token) return;
    fetchTemplates();
    const poll = setInterval(() => fetchTemplates(), 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchTemplates(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.token]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/client-notifications/templates', {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${user?.token}` }
      });
      if (!response.ok) throw new Error();
      setTemplates(await response.json());
    } catch {
      toast.error('Could not load message templates. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this message template? This cannot be undone.')) return;
    try {
      const response = await fetch(`/api/client-notifications/templates/${id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${user?.token}` }
      });
      if (!response.ok) throw new Error();
      toast.success('Template deleted successfully.');
      fetchTemplates();
    } catch {
      toast.error('Could not delete the template. Please try again.');
    }
  };

  const handleSave = async (templateData) => {
    try {
      const method = currentTemplate ? 'PUT' : 'POST';
      const url = currentTemplate
        ? `/api/client-notifications/templates/${currentTemplate.id}`
        : '/api/client-notifications/templates';
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify(templateData)
      });
      if (!response.ok) throw new Error();
      toast.success(currentTemplate ? 'Template updated.' : 'New template created.');
      setIsModalOpen(false);
      fetchTemplates();
    } catch {
      toast.error('Could not save the template. Please try again.');
    }
  };

  const openModal = (template = null) => {
    setCurrentTemplate(template);
    setIsModalOpen(true);
  };

  if (loading) return (
    <div className="p-8 text-center text-zinc-400">Loading message templates…</div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-zinc-100 uppercase tracking-tight">Message Templates</h2>
          <p className="text-sm text-zinc-400 mt-1">
            These are pre-written messages sent automatically or manually to clients — by email or SMS.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors shrink-0"
        >
          <FiPlus size={16} /> New Message Template
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800/60 text-zinc-400 text-xs uppercase tracking-widest">
              <th className="px-4 py-3 font-bold">Template Name</th>
              <th className="px-4 py-3 font-bold">Sent Via</th>
              <th className="px-4 py-3 font-bold">When It Sends</th>
              <th className="px-4 py-3 font-bold text-center">Active?</th>
              <th className="px-4 py-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-zinc-700/50">
            {templates.map(t => (
              <tr key={t.id} className="hover:bg-zinc-800/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-zinc-200">{t.name}</div>
                  {t.subject && (
                    <div className="text-xs text-zinc-500 mt-0.5">Subject: {t.subject}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-700 text-zinc-300">
                    {t.channel === 'email' ? <FiMail size={11} /> : <FiMessageSquare size={11} />}
                    {t.channel === 'email' ? 'Email' : 'SMS'}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{eventLabel(t.event_key)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                    t.is_active
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                      : 'bg-zinc-700/50 text-zinc-500 border border-zinc-600/30'
                  }`}>
                    {t.is_active ? 'Yes — Active' : 'No — Paused'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openModal(t)}
                      title="Edit this template"
                      className="p-2 text-zinc-400 hover:text-emerald-400 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      <FiEdit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      title="Delete this template"
                      className="p-2 text-zinc-400 hover:text-rose-400 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                  No message templates yet. Click <strong>New Message Template</strong> to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <TemplateFormModal
          template={currentTemplate}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function TemplateFormModal({ template, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name:      template?.name      || '',
    channel:   template?.channel   || 'email',
    event_key: template?.event_key || '',
    subject:   template?.subject   || '',
    body:      template?.body      || '',
    is_active: template !== null ? template?.is_active : true,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-700">
          <h2 className="text-lg font-black text-zinc-100 uppercase tracking-tight">
            {template ? 'Edit Message Template' : 'Create New Message Template'}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Fill in the details below. Use the placeholders to personalise each message automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Template Name */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
              Template Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text" required
              placeholder="e.g. Appointment Confirmed — Email"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-600 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-zinc-600"
            />
          </div>

          {/* Send Via + When It Sends */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                Send Via
              </label>
              <select
                value={formData.channel}
                onChange={e => setFormData({ ...formData, channel: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-600 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none transition-colors"
              >
                <option value="email">📧 Email</option>
                <option value="sms">💬 SMS (Text Message)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                When to Send
              </label>
              <select
                value={formData.event_key}
                onChange={e => setFormData({ ...formData, event_key: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-600 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none transition-colors"
              >
                {EVENT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Email Subject (email only) */}
          {formData.channel === 'email' && (
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                Email Subject Line <span className="text-rose-400">*</span>
              </label>
              <input
                type="text" required
                placeholder="e.g. Your appointment has been confirmed!"
                value={formData.subject}
                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-600 text-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-zinc-600"
              />
            </div>
          )}

          {/* Message Body */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
              Message Body <span className="text-rose-400">*</span>
            </label>
            {/* Variable hints */}
            <div className="mb-2 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <FiBell size={10} /> Auto-fill placeholders — type these in your message
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLE_HINTS.map(v => (
                  <span
                    key={v.tag}
                    title={v.desc}
                    className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 cursor-default"
                  >
                    {v.tag}
                    <span className="font-sans font-normal text-zinc-500 ml-1 not-italic">= {v.desc}</span>
                  </span>
                ))}
              </div>
            </div>
            <textarea
              required rows={5}
              placeholder={`Hi {owner_name}, your appointment for {pet_name} on {date} at {time} has been confirmed. See you soon!`}
              value={formData.body}
              onChange={e => setFormData({ ...formData, body: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-600 text-zinc-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none transition-colors resize-none placeholder:text-zinc-600"
            />
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none group">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={formData.is_active}
                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.is_active ? 'left-5' : 'left-1'}`} />
            </div>
            <div>
              <span className="text-sm font-bold text-zinc-200">
                {formData.is_active ? 'Template is active — will be sent' : 'Template is paused — will not be sent'}
              </span>
              <p className="text-xs text-zinc-500">Turn this off if you want to stop sending this message temporarily.</p>
            </div>
          </label>

          {/* Footer buttons */}
          <div className="flex gap-3 pt-2 border-t border-zinc-700">
            <button
              type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {template ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
