import React, { useEffect, useState } from 'react';
import { FiVolume2, FiPlus, FiTrash2, FiEdit2, FiClock, FiMonitor, FiGlobe, FiX, FiCheckCircle, FiAlertCircle, FiInfo, FiAlertTriangle } from 'react-icons/fi';
import api from '../api';
import { useToast } from '../context/ToastContext';
import clsx from 'clsx';

const TYPE_CONFIG = {
  info:    { label: 'Info',    icon: FiInfo,          row: 'border-l-blue-400',   badge: 'bg-blue-50 text-blue-700 ring-blue-200',   dot: 'bg-blue-400' },
  success: { label: 'Success', icon: FiCheckCircle,   row: 'border-l-emerald-400',badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-400' },
  warning: { label: 'Warning', icon: FiAlertTriangle, row: 'border-l-amber-400',  badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-400' },
  error:   { label: 'Urgent',  icon: FiAlertCircle,   row: 'border-l-rose-400',   badge: 'bg-rose-50 text-rose-700 ring-rose-200',   dot: 'bg-rose-400' },
};

const TARGET_CONFIG = {
  admin:   { label: 'Admin Panel',  icon: FiMonitor, cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400' },
  portal:  { label: 'Web Portal',  icon: FiGlobe,   cls: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-400' },
  landing: { label: 'Landing Page',icon: FiGlobe,   cls: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400' },
  all:     { label: 'Everywhere',  icon: FiGlobe,   cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400' },
};

const EMPTY_FORM = { title: '', message: '', type: 'info', active_until: '', is_active: true, target: 'admin' };

function StatusPill({ announcement }) {
  const isExpired = announcement.active_until && new Date(announcement.active_until) < new Date();
  if (isExpired)             return <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">Expired</span>;
  if (!announcement.is_active) return <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">Inactive</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Live
    </span>
  );
}

export default function SuperAdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const toast = useToast();

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/api/super-admin/announcements');
      setAnnouncements(res);
    } catch {
      toast.error('Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAnnouncements(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const openNew = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (ann) => {
    setEditingId(ann.id);
    setFormData({
      title: ann.title,
      message: ann.message || '',
      type: ann.type,
      active_until: ann.active_until ? new Date(ann.active_until).toISOString().slice(0, 16) : '',
      is_active: !!ann.is_active,
      target: ann.target || 'admin',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { ...formData, active_until: formData.active_until ? new Date(formData.active_until).toISOString() : null };
      if (editingId) {
        await api.put(`/api/super-admin/announcements/${editingId}`, payload);
        toast.success('Broadcast updated.');
      } else {
        await api.post('/api/super-admin/announcements', payload);
        toast.success('Broadcast is now live.');
      }
      closeModal();
      fetchAnnouncements();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save broadcast.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this broadcast permanently?')) return;
    try {
      await api.delete(`/api/super-admin/announcements/${id}`);
      toast.success('Broadcast deleted.');
      fetchAnnouncements();
    } catch {
      toast.error('Failed to delete broadcast.');
    }
  };

  return (
    <div className="space-y-6">

      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">System Broadcasts</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Push platform-wide announcements to admins, the portal, and the landing page.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-xl bg-autovet-teal px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-autovet-teal/20 hover:opacity-90 transition-all"
        >
          <FiPlus className="h-4 w-4" /> New Broadcast
        </button>
      </div>

      {/* â”€â”€ Table â”€â”€ */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-dark-border dark:bg-dark-card shadow-sm">

        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 border-b border-zinc-100 dark:border-dark-border bg-zinc-50/60 dark:bg-dark-surface/40 px-6 py-3">
          {['Broadcast', 'Target', 'Type', 'Expires', 'Status'].map(h => (
            <span key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="divide-y divide-zinc-50 dark:divide-dark-border">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 px-6 py-4 animate-pulse">
                <div className="h-4 rounded bg-zinc-100 dark:bg-dark-surface w-3/4" />
                <div className="h-4 rounded bg-zinc-100 dark:bg-dark-surface w-20" />
                <div className="h-4 rounded bg-zinc-100 dark:bg-dark-surface w-16" />
                <div className="h-4 rounded bg-zinc-100 dark:bg-dark-surface w-24" />
                <div className="h-4 rounded bg-zinc-100 dark:bg-dark-surface w-16" />
              </div>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-50 dark:bg-dark-surface">
              <FiVolume2 className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            </div>
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No broadcasts yet</p>
            <button onClick={openNew} className="text-xs font-bold text-autovet-teal hover:underline">Create the first one</button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50 dark:divide-dark-border">
            {announcements.map((ann) => {
              const tc = TYPE_CONFIG[ann.type] ?? TYPE_CONFIG.info;
              const tg = TARGET_CONFIG[ann.target] ?? TARGET_CONFIG.admin;
              const Icon = tc.icon;
              const TgIcon = tg.icon;
              return (
                <div
                  key={ann.id}
                  className={clsx(
                    'group grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 items-center px-6 py-4 border-l-4 hover:bg-zinc-50/60 dark:hover:bg-dark-surface/30 transition-colors cursor-pointer',
                    tc.row
                  )}
                  onClick={() => openEdit(ann)}
                >
                  {/* Title + message */}
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{ann.title}</p>
                    {ann.message && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-sm">{ann.message}</p>
                    )}
                  </div>

                  {/* Target */}
                  <span className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ring-1', tg.cls)}>
                    <TgIcon className="h-3 w-3" />{tg.label}
                  </span>

                  {/* Type */}
                  <span className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ring-1', tc.badge)}>
                    <Icon className="h-3 w-3" />{tc.label}
                  </span>

                  {/* Expires */}
                  <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">
                    {ann.active_until
                      ? new Date(ann.active_until) < new Date()
                        ? <span className="text-rose-400">Expired {new Date(ann.active_until).toLocaleDateString()}</span>
                        : `Until ${new Date(ann.active_until).toLocaleDateString()}`
                      : <span className="italic opacity-60">No expiry</span>}
                  </span>

                  {/* Status + actions */}
                  <div className="flex items-center gap-3">
                    <StatusPill announcement={ann} />
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(ann); }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-autovet-teal hover:bg-autovet-teal/10 transition-colors"
                        title="Edit"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, ann.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* â”€â”€ Modal â”€â”€ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={closeModal}>
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-dark-card shadow-2xl border border-zinc-200 dark:border-dark-border animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-dark-border">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-autovet-teal/10">
                  <FiVolume2 className="h-4 w-4 text-autovet-teal" />
                </div>
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-zinc-50">{editingId ? 'Edit Broadcast' : 'New Broadcast'}</h2>
                  <p className="text-xs text-zinc-400">{editingId ? 'Update the broadcast details below.' : 'Fill in the details to publish a new broadcast.'}</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors">
                <FiX className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

              {/* Title */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Title *</label>
                <input
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="input-field"
                  placeholder="e.g. Scheduled maintenance on May 20"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Message <span className="normal-case font-medium opacity-60">(optional)</span></label>
                <textarea
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Provide additional context or instructions..."
                />
              </div>

              {/* Type + Expiry */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Category</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="input-field bg-white dark:bg-dark-surface"
                  >
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5">Expires <span className="normal-case font-medium opacity-60">(optional)</span></label>
                  <input
                    type="datetime-local"
                    value={formData.active_until}
                    onChange={e => setFormData({ ...formData, active_until: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Target audience */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">Target Audience</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'admin',   label: 'Admin Panel',  icon: FiMonitor, desc: 'Clinic staff only' },
                    { value: 'portal',  label: 'Web Portal',   icon: FiGlobe,   desc: 'Logged-in owners' },
                    { value: 'landing', label: 'Landing Page', icon: FiGlobe,   desc: 'Public visitors' },
                    { value: 'all',     label: 'Everywhere',   icon: FiGlobe,   desc: 'All audiences' },
                  ].map(opt => {
                    const Ic = opt.icon;
                    const selected = formData.target === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, target: opt.value })}
                        className={clsx(
                          'flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all',
                          selected
                            ? 'border-autovet-teal bg-autovet-teal/5 dark:bg-autovet-teal/10'
                            : 'border-zinc-200 dark:border-dark-border hover:border-zinc-300 dark:hover:border-zinc-600'
                        )}
                      >
                        <Ic className={clsx('h-4 w-4 shrink-0', selected ? 'text-autovet-teal' : 'text-zinc-400')} />
                        <div className="min-w-0">
                          <p className={clsx('text-xs font-black leading-tight', selected ? 'text-autovet-teal' : 'text-zinc-700 dark:text-zinc-300')}>{opt.label}</p>
                          <p className="text-[10px] text-zinc-400 leading-tight">{opt.desc}</p>
                        </div>
                        {selected && <span className="ml-auto h-2 w-2 rounded-full bg-autovet-teal shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-dark-border mt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-autovet-teal px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 shadow-lg shadow-autovet-teal/20 transition-all"
                >
                  {isSubmitting
                    ? (editingId ? 'Saving...' : 'Publishing...')
                    : (editingId ? 'Save Changes' : 'Publish Broadcast')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
