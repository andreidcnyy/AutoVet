import React, { useEffect, useState } from 'react';
import { FiVolume2, FiPlus, FiTrash2, FiClock, FiCheckCircle } from 'react-icons/fi';
import api from '../api';
import { useToast } from '../context/ToastContext';
import clsx from 'clsx';

export default function SuperAdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    active_until: '',
    is_active: true
  });

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/api/super-admin/announcements');
      setAnnouncements(res);
    } catch (err) {
      toast.error('Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const openEditModal = (ann) => {
    setEditingId(ann.id);
    setFormData({
      title: ann.title,
      message: ann.message,
      type: ann.type,
      active_until: ann.active_until ? new Date(ann.active_until).toISOString().slice(0, 16) : '',
      is_active: !!ann.is_active
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        active_until: formData.active_until ? new Date(formData.active_until).toISOString() : null
      };

      if (editingId) {
        await api.put(`/api/super-admin/announcements/${editingId}`, payload);
        toast.success('Announcement updated successfully!');
      } else {
        await api.post('/api/super-admin/announcements', payload);
        toast.success('Announcement broadcasted successfully!');
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ title: '', message: '', type: 'info', active_until: '', is_active: true });
      fetchAnnouncements();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/api/super-admin/announcements/${id}`);
      toast.success('Announcement removed.');
      fetchAnnouncements();
    } catch (err) {
      toast.error('Failed to remove announcement.');
    }
  };

  const getToneStyles = (type) => {
     switch(type) {
        case 'warning': return "bg-amber-100 text-amber-700 border-amber-200";
        case 'error': return "bg-rose-100 text-rose-700 border-rose-200";
        case 'success': return "bg-emerald-100 text-emerald-700 border-emerald-200";
        default: return "bg-blue-100 text-blue-700 border-blue-200";
     }
  };

  if (loading) return <div className="p-8 text-zinc-500">Loading announcements...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-autovet-navy dark:text-zinc-50 uppercase">System Broadcasts</h1>
          <p className="mt-1 text-base font-bold text-autovet-teal">Manage platform-wide announcements for all clinics.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-autovet-teal px-5 py-3 font-bold text-white hover:opacity-90 shadow-lg shadow-autovet-teal/20 transition-all">
          <FiPlus className="h-5 w-5" /> New Broadcast
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
         {announcements.length === 0 ? (
            <div className="col-span-full py-12 text-center card-shell flex flex-col items-center justify-center">
               <FiVolume2 className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mb-4" />
               <p className="text-sm font-black uppercase tracking-widest text-zinc-400">No active broadcasts</p>
            </div>
         ) : (
            announcements.map(announcement => (
               <div 
                  key={announcement.id} 
                  onClick={() => openEditModal(announcement)}
                  className="card-shell p-6 flex flex-col justify-between border-t-4 cursor-pointer hover:shadow-xl transition-all duration-300 group" 
                  style={{ borderColor: announcement.type === 'error' ? '#f43f5e' : announcement.type === 'warning' ? '#f59e0b' : announcement.type === 'success' ? '#10b981' : '#3b82f6' }}
               >
                  <div>
                     <div className="flex items-start justify-between mb-4">
                        <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border", getToneStyles(announcement.type))}>
                           {announcement.type}
                        </span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                              onClick={(e) => handleDelete(e, announcement.id)} 
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                              title="Delete Broadcast"
                           >
                              <FiTrash2 className="h-4 w-4" />
                           </button>
                        </div>
                     </div>
                     <h3 className="text-lg font-black text-zinc-900 dark:text-white leading-tight mb-2 group-hover:text-autovet-teal transition-colors">
                        {announcement.title}
                     </h3>
                     <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                        {announcement.message || <span className="italic opacity-50">No message provided.</span>}
                     </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-100 dark:border-dark-border pt-4">
                     <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                        <FiClock className="h-3 w-3" />
                        {new Date(announcement.created_at).toLocaleDateString()}
                     </div>
                     <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                        {(() => {
                           const isExpired = announcement.active_until && new Date(announcement.active_until) < new Date();
                           if (isExpired) {
                              return <span className="flex items-center gap-1 text-rose-500"><FiClock className="h-3 w-3" /> Ended</span>;
                           }
                           return announcement.is_active ? (
                              <span className="flex items-center gap-1 text-emerald-500"><FiCheckCircle className="h-3 w-3" /> Active</span>
                           ) : (
                              <span className="text-zinc-500">Inactive</span>
                           );
                        })()}
                     </div>
                  </div>
               </div>
            ))
         )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-autovet-navy/40 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl dark:bg-dark-card border dark:border-dark-border animate-in zoom-in-95 duration-200 my-8">
            <h3 className="text-2xl font-black text-autovet-navy dark:text-zinc-50 mb-6 uppercase tracking-tight flex items-center gap-3">
               <FiVolume2 className="text-autovet-teal" /> {editingId ? 'Edit Platform Broadcast' : 'New Platform Broadcast'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                 <label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Announcement Title *</label>
                 <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="input-field border-autovet-navy/10 focus:border-autovet-teal" placeholder="e.g. Scheduled Maintenance" />
              </div>
              <div>
                 <label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Message (Optional)</label>
                 <textarea value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} className="input-field min-h-[120px] pt-3 border-autovet-navy/10 focus:border-autovet-teal" placeholder="Detail the announcement..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Message Category (Optional)</label>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="input-field border-autovet-navy/10 focus:border-autovet-teal bg-white dark:bg-dark-surface">
                       <option value="info">Info (Blue - Default)</option>
                       <option value="success">Success (Green)</option>
                       <option value="warning">Warning (Yellow)</option>
                       <option value="error">Urgent (Red)</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Active Until (Optional)</label>
                    <input type="datetime-local" value={formData.active_until} onChange={e => setFormData({...formData, active_until: e.target.value})} className="input-field border-autovet-navy/10 focus:border-autovet-teal" />
                 </div>
              </div>
              
              <div className="flex gap-3 pt-6 border-t border-zinc-100 dark:border-dark-border mt-8">
                 <button type="button" onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="flex-1 py-4 font-black uppercase text-zinc-400 hover:text-autovet-navy tracking-widest">Cancel</button>
                 <button type="submit" disabled={isSubmitting} className="flex-2 rounded-2xl bg-autovet-teal px-10 py-4 font-black uppercase text-white hover:opacity-90 shadow-xl shadow-autovet-teal/20 disabled:opacity-50 tracking-widest">
                    {isSubmitting ? (editingId ? 'Updating...' : 'Broadcasting...') : (editingId ? 'Update Broadcast' : 'Broadcast Now')}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
