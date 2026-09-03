import React, { useEffect, useState } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { FiShield, FiUserPlus, FiX, FiEye, FiEyeOff, FiTrash2 } from 'react-icons/fi';
import clsx from 'clsx';

export default function SuperAdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const toast = useToast();

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/super-admin/admins');
      setAdmins(Array.isArray(res) ? res : []);
    } catch {
      toast.error('Failed to load super admins.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAdmins(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const openModal = () => {
    setForm({ name: '', email: '', password: '' });
    setShowPassword(false);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/super-admin/admins', form);
      toast.success('Super Admin created successfully.');
      setModalOpen(false);
      fetchAdmins();
    } catch (err) {
      const msg = err.response?.data?.errors
        ? Object.values(err.response.data.errors)[0][0]
        : (err.response?.data?.message || 'Failed to create Super Admin.');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-autovet-navy dark:text-zinc-50 uppercase">Super Admins</h1>
          <p className="mt-1 text-base font-bold text-autovet-teal uppercase tracking-tight">Manage platform-level administrator accounts.</p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-xl bg-autovet-teal px-5 py-3 font-bold text-white hover:opacity-90 shadow-lg shadow-autovet-teal/20 transition-all uppercase tracking-widest text-xs"
        >
          <FiUserPlus className="h-4 w-4" /> Add Super Admin
        </button>
      </div>

      <div className="card-shell overflow-hidden border-t-4 border-autovet-navy">
        <div className="border-b border-zinc-100 bg-zinc-50/50 p-6 dark:border-dark-border dark:bg-dark-surface/50 flex items-center gap-3">
          <FiShield className="h-5 w-5 text-autovet-navy dark:text-autovet-teal" />
          <h3 className="text-xl font-black text-autovet-navy dark:text-zinc-50 uppercase tracking-tight">Platform Super Admins</h3>
        </div>

        {loading ? (
          <p className="p-8 text-zinc-500 font-black uppercase tracking-widest text-sm animate-pulse">Loading...</p>
        ) : admins.length === 0 ? (
          <div className="py-16 text-center">
            <FiShield className="mx-auto h-10 w-10 text-zinc-300 mb-3" />
            <p className="text-sm font-black uppercase tracking-widest text-zinc-400">No super admins found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-zinc-50/50 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:bg-dark-surface/30 dark:text-zinc-500">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-autovet-navy-light/30 dark:hover:bg-dark-surface/40 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-autovet-navy flex items-center justify-center text-white font-black text-sm">
                          {admin.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-black text-zinc-900 dark:text-zinc-100 uppercase text-xs">{admin.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-zinc-500 dark:text-zinc-400">{admin.email}</td>
                    <td className="px-6 py-5">
                      <span className={clsx(
                        "inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                        admin.status === 'active'
                          ? "bg-autovet-teal/10 text-autovet-teal border border-autovet-teal/20"
                          : "bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                      )}>
                        {admin.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-[11px] font-bold text-zinc-400">
                      {new Date(admin.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-autovet-navy/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl dark:bg-dark-card border dark:border-dark-border animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-autovet-navy dark:text-zinc-50 uppercase tracking-tight">New Super Admin</h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-autovet-navy dark:text-zinc-400 mb-1">Full Name</label>
                <input
                  required type="text" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input-field text-xs font-bold" placeholder="e.g. Juan Dela Cruz"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-autovet-navy dark:text-zinc-400 mb-1">Email Address</label>
                <input
                  required type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input-field text-xs font-bold" placeholder="admin@autovet.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-autovet-navy dark:text-zinc-400 mb-1">Password</label>
                <div className="relative">
                  <input
                    required type={showPassword ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="input-field text-xs font-bold pr-10" placeholder="Min. 8 characters" minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-zinc-100 dark:border-dark-border mt-6">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3 font-black uppercase text-xs tracking-widest text-zinc-400 hover:text-autovet-navy">Cancel</button>
                <button
                  type="submit" disabled={submitting}
                  className="flex-1 rounded-2xl bg-autovet-teal py-3 font-black uppercase text-xs tracking-widest text-white hover:opacity-90 disabled:opacity-50 shadow-lg"
                >
                  {submitting ? 'Creating...' : 'Create Super Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
