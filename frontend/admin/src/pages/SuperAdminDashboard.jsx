import React, { useEffect, useState } from 'react';
import { 
  FiHome, FiPlus, FiActivity, FiCheckCircle, FiAlertCircle, 
  FiMail, FiPhone, FiMapPin, FiEdit2, FiUpload, FiImage, 
  FiMap, FiUsers, FiLock, FiLogOut, FiCalendar, FiStar,
  FiChevronLeft, FiChevronRight, FiFilter
} from 'react-icons/fi';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

// Simple Map Preview Component
const MapPreview = ({ address }) => {
  if (!address || address.length < 5) return (
    <div className="h-48 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-700">
       <div className="text-center">
          <FiMap className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest px-8 text-center">Enter a complete address to preview location</p>
       </div>
    </div>
  );

  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`;

  return (
    <div className="h-64 w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-dark-border shadow-xl relative group">
      <iframe
        title="clinic-map"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        src={mapUrl}
      ></iframe>
      <div className="absolute top-3 left-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm pointer-events-none transition-opacity group-hover:opacity-0">
         <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
           <FiMapPin className="text-autovet-teal" /> Live Location Preview
         </p>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="card-shell p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{title}</p>
        <p className="mt-2 text-3xl font-black text-zinc-900 dark:text-zinc-50">{value}</p>
      </div>
      <div className={`rounded-xl p-3 ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </div>
);

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [debouncedAddress, setDebouncedAddress] = useState('');
  
  // Admins state with pagination
  const [clinicAdminsData, setClinicAdminsData] = useState({ data: [], current_page: 1, last_page: 1 });
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminsPage, setAdminsPage] = useState(1);

  const toast = useToast();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    clinic_name: '',
    owner_name: '',
    email: '',
    contact_number: '',
    contact_number_2: '',
    address: '',
    subscription_tier: 'Free Trial',
    subscription_expires_at: ''
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAddress(formData.address);
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData.address]);

  const fetchData = async () => {
    try {
      const [statsRes, clinicsRes] = await Promise.all([
        api.get('/api/super-admin/stats'),
        api.get('/api/super-admin/clinics')
      ]);
      setStats(statsRes);
      setClinics(clinicsRes);
    } catch (err) {
      toast.error('Failed to load platform data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchAdmins = async (clinicId, pageNum = 1) => {
    setLoadingAdmins(true);
    try {
      const res = await api.get(`/api/super-admin/clinics/${clinicId}/admins?page=${pageNum}`);
      setClinicAdminsData(res);
    } catch (err) {
      toast.error('Failed to load clinic staff.');
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    if (selectedClinic && activeTab === 'admins') {
      fetchAdmins(selectedClinic.id, adminsPage);
    }
  }, [selectedClinic, activeTab, adminsPage]);

  const handleToggleStatus = async (e, clinic) => {
    e.stopPropagation();
    try {
      await api.post(`/api/super-admin/clinics/${clinic.id}/toggle-status`);
      toast.success(`Clinic status updated.`);
      if (selectedClinic?.id === clinic.id) {
        setSelectedClinic({ ...selectedClinic, status: selectedClinic.status === 'active' ? 'inactive' : 'active' });
      }
      fetchData();
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  const handleRowClick = (clinic) => {
    setSelectedClinic(clinic);
    setActiveTab('overview');
    setAdminsPage(1);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const openRegisterModal = () => {
    setEditMode(false);
    setFormData({ 
      clinic_name: '', owner_name: '', email: '', contact_number: '', contact_number_2: '', address: '',
      subscription_tier: 'Free Trial', subscription_expires_at: ''
    });
    setLogoFile(null);
    setLogoPreview(null);
    setDebouncedAddress('');
    setIsModalOpen(true);
  };

  const openEditModal = (clinic) => {
    setSelectedClinic(clinic);
    setEditMode(true);
    setFormData({
      clinic_name: clinic.clinic_name,
      owner_name: clinic.owner_name || '',
      email: clinic.email,
      contact_number: clinic.contact_number || '',
      contact_number_2: clinic.contact_number_2 || '',
      address: clinic.address || '',
      subscription_tier: clinic.subscription_tier || 'Free Trial',
      subscription_expires_at: clinic.subscription_expires_at ? clinic.subscription_expires_at.split('T')[0] : ''
    });
    setLogoFile(null);
    setLogoPreview(clinic.logo ? `/storage/${clinic.logo}` : null);
    setDebouncedAddress(clinic.address || '');
    setIsModalOpen(true);
  };

  const handleSubmitClinic = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const data = new FormData();
    data.append('clinic_name', formData.clinic_name);
    data.append('owner_name', formData.owner_name || '');
    data.append('email', formData.email);
    data.append('contact_number', formData.contact_number || '');
    data.append('contact_number_2', formData.contact_number_2 || '');
    data.append('address', formData.address || '');
    data.append('subscription_tier', formData.subscription_tier || 'Free Trial');
    if (formData.subscription_expires_at) {
       data.append('subscription_expires_at', formData.subscription_expires_at);
    }
    
    if (logoFile) data.append('logo', logoFile);

    try {
      let url = '/api/super-admin/clinics';
      if (editMode) {
        url += `/${selectedClinic.id}`;
        data.append('_method', 'PUT');
      }

      let token = '';
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) token = JSON.parse(storedUser).token;
      } catch (err) {}

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
        body: data
      });

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.message || 'Failed to save clinic.');
      
      toast.success(editMode ? 'Clinic updated successfully!' : 'Clinic registered successfully!');
      setIsModalOpen(false);
      
      fetchData();
      
      if (selectedClinic) {
          const updatedRes = await api.get('/api/super-admin/clinics');
          const updated = updatedRes.find(c => c.id === selectedClinic.id);
          if (updated) setSelectedClinic(updated);
      }
    } catch (err) {
       toast.error(err.message || 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (adminId) => {
    const newPassword = prompt("Enter new password for this admin (min 8 chars):");
    if (!newPassword || newPassword.length < 8) {
      if (newPassword !== null) toast.error("Password must be at least 8 characters.");
      return;
    }
    
    try {
      await api.post(`/api/super-admin/clinics/${selectedClinic.id}/admins/${adminId}/reset-password`, {
        password: newPassword,
        password_confirmation: newPassword
      });
      toast.success("Password reset successfully.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset password.");
    }
  };

  const handleImpersonate = async () => {
    if (!window.confirm(`Are you sure you want to log in as ${selectedClinic.clinic_name}?`)) return;
    
    try {
      const res = await api.post(`/api/super-admin/impersonate/${selectedClinic.id}`);
      toast.success("Impersonation started.");
      const currentSession = localStorage.getItem('user');
      if (currentSession) localStorage.setItem('super_admin_session', currentSession);
      login({ ...res.admin, token: res.token, is_impersonating: true });
      window.location.href = '/';
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start impersonation.");
    }
  };

  if (loading) return <div className="p-8 text-zinc-500 font-black uppercase tracking-widest text-sm animate-pulse">Platform Syncing...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-autovet-navy dark:text-zinc-50 uppercase">AutoVet Platform</h1>
          <p className="mt-1 text-base font-bold text-autovet-teal dark:text-autovet-teal uppercase tracking-tight">Global SaaS Management and Clinic Monitoring.</p>
        </div>
        <button onClick={openRegisterModal} className="inline-flex items-center gap-2 rounded-xl bg-autovet-teal px-5 py-3 font-bold text-white hover:opacity-90 shadow-lg shadow-autovet-teal/20 transition-all uppercase tracking-widest">
          <FiPlus className="h-5 w-5" /> Register New Clinic
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard title="Total Registered Clinics" value={stats?.total_clinics || 0} icon={FiHome} color="bg-autovet-navy" />
        <StatCard title="Active Clinics" value={stats?.active_clinics || 0} icon={FiCheckCircle} color="bg-autovet-teal" />
        <StatCard title="Inactive Clinics" value={stats?.inactive_clinics || 0} icon={FiAlertCircle} color="bg-rose-500" />
      </div>

      <div className="card-shell overflow-hidden border-t-4 border-autovet-navy">
        <div className="border-b border-zinc-100 bg-zinc-50/50 p-6 dark:border-dark-border dark:bg-dark-surface/50">
          <h3 className="text-xl font-black text-autovet-navy dark:text-zinc-50 uppercase tracking-tight">Registered Clinics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-zinc-50/50 text-left text-xs font-black uppercase tracking-widest text-zinc-400 dark:bg-dark-surface/30 dark:text-zinc-500">
              <tr>
                <th className="px-6 py-4">Clinic Identity</th>
                <th className="px-6 py-4">Owner / Contact</th>
                <th className="px-6 py-4">Subscription</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-dark-border">
              {clinics.map((clinic) => (
                <tr key={clinic.id} onClick={() => handleRowClick(clinic)} className="hover:bg-autovet-navy-light/30 transition-colors dark:hover:bg-dark-surface/40 cursor-pointer group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      {clinic.logo ? (
                        <img src={`/storage/${clinic.logo}`} className="h-12 w-12 rounded-2xl object-cover shadow-sm bg-white" alt="logo" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-lg dark:bg-zinc-800 group-hover:scale-110 transition-transform text-2xl">🏥</div>
                      )}
                      <div>
                        <p className="font-black text-autovet-navy dark:text-zinc-100 uppercase tracking-tight text-xs">{clinic.clinic_name}</p>
                        <p className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest"><FiMapPin className="h-3 w-3 text-autovet-teal" />{clinic.address || 'No address'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{clinic.owner_name || 'N/A'}</p>
                      <div className="flex flex-col gap-0.5">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400"><FiMail className="h-3 w-3 text-autovet-navy" /> {clinic.email}</p>
                        <div className="flex flex-wrap gap-x-2">
                           {clinic.contact_number && <p className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400"><FiPhone className="h-3 w-3 text-autovet-teal" /> {clinic.contact_number}</p>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                     <span className="inline-flex rounded-md bg-purple-100 px-2 py-1 text-[10px] font-black uppercase text-purple-700 tracking-widest border border-purple-200">{clinic.subscription_tier || 'Free Trial'}</span>
                     {clinic.subscription_expires_at && <p className="mt-1 text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Exp: {new Date(clinic.subscription_expires_at).toLocaleDateString()}</p>}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={clsx("inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm", clinic.status === 'active' ? "bg-autovet-teal/10 text-autovet-teal border border-autovet-teal/20" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400")}>{clinic.status}</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button onClick={(e) => { e.stopPropagation(); openEditModal(clinic); }} className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-400 hover:text-autovet-teal dark:border-dark-border dark:bg-dark-card transition-all"><FiEdit2 className="h-4 w-4" /></button>
                       <button onClick={(e) => handleToggleStatus(e, clinic)} className={clsx("rounded-lg border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all", clinic.status === 'active' ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-autovet-teal/30 text-autovet-teal hover:bg-autovet-teal/5")}>{clinic.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clinic Details Modal */}
      {selectedClinic && !isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-autovet-navy/40 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl bg-white overflow-hidden shadow-2xl dark:bg-dark-card border dark:border-dark-border animate-in zoom-in-95 duration-200 my-8">
             <div className="h-32 bg-gradient-to-br from-autovet-navy to-autovet-teal p-8 relative">
                <div className="absolute -bottom-8 left-8">
                   <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white overflow-hidden shadow-xl dark:bg-dark-surface border-4 border-white dark:border-dark-card">
                     {selectedClinic.logo ? <img src={`/storage/${selectedClinic.logo}`} className="h-full w-full object-cover" alt="logo" /> : <span className="text-5xl text-zinc-300">🏥</span>}
                   </div>
                </div>
                <div className="absolute top-6 right-6 flex gap-2">
                   <button onClick={handleImpersonate} className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-xs font-black uppercase text-white shadow-lg transition-all"><FiLogOut className="h-3 w-3" /> Login As Ghost</button>
                   <button onClick={() => openEditModal(selectedClinic)} className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-xs font-black uppercase text-white backdrop-blur-md hover:bg-white/30 transition-all"><FiEdit2 className="h-3 w-3" /> Edit Details</button>
                </div>
             </div>
             <div className="p-8 pt-12">
                <div className="flex justify-between items-start">
                   <div>
                      <h3 className="text-3xl font-black text-autovet-navy dark:text-zinc-50 uppercase tracking-tight">{selectedClinic.clinic_name}</h3>
                      <p className="text-sm font-black text-autovet-teal uppercase tracking-widest mt-1">Clinic ID: #{selectedClinic.id}</p>
                   </div>
                   <span className={clsx("rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest", selectedClinic.status === 'active' ? "bg-autovet-teal/10 text-autovet-teal border border-autovet-teal/20" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400")}>{selectedClinic.status}</span>
                </div>
                
                <div className="mt-8 flex gap-6 border-b border-zinc-200 dark:border-dark-border">
                   <button onClick={() => setActiveTab('overview')} className={clsx("pb-3 text-sm font-black uppercase tracking-widest transition-colors border-b-2", activeTab === 'overview' ? "border-autovet-navy text-autovet-navy dark:border-autovet-teal dark:text-autovet-teal" : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300")}>Overview</button>
                   <button onClick={() => setActiveTab('subscription')} className={clsx("pb-3 text-sm font-black uppercase tracking-widest transition-colors border-b-2", activeTab === 'subscription' ? "border-autovet-navy text-autovet-navy dark:border-autovet-teal dark:text-autovet-teal" : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300")}>Subscription</button>
                   <button onClick={() => setActiveTab('admins')} className={clsx("pb-3 text-sm font-black uppercase tracking-widest transition-colors border-b-2", activeTab === 'admins' ? "border-autovet-navy text-autovet-navy dark:border-autovet-teal dark:text-autovet-teal" : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300")}>Staff / Users</button>
                </div>

                <div className="mt-6 min-h-[300px]">
                   {activeTab === 'overview' && (
                     <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="grid grid-cols-2 gap-8">
                           <div className="space-y-6">
                              <div><p className="text-[10px] font-black uppercase text-autovet-teal mb-2 tracking-widest">Clinic Owner</p><p className="font-black text-zinc-800 dark:text-zinc-200 uppercase text-sm">{selectedClinic.owner_name || 'Not Specified'}</p></div>
                              <div><p className="text-[10px] font-black uppercase text-autovet-teal mb-2 tracking-widest">Email Address</p><p className="font-black text-zinc-800 dark:text-zinc-200 text-sm tracking-tight">{selectedClinic.email}</p></div>
                           </div>
                           <div className="space-y-6">
                              <div><p className="text-[10px] font-black uppercase text-autovet-teal mb-2 tracking-widest">Contact Numbers</p><p className="font-black text-zinc-800 dark:text-zinc-200 text-sm">{selectedClinic.contact_number || 'N/A'}{selectedClinic.contact_number_2 ? ` / ${selectedClinic.contact_number_2}` : ''}</p></div>
                              <div><p className="text-[10px] font-black uppercase text-autovet-teal mb-2 tracking-widest">Registration Date</p><p className="font-black text-zinc-800 dark:text-zinc-200 text-sm">{new Date(selectedClinic.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</p></div>
                           </div>
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase text-autovet-teal mb-2 tracking-widest">Clinic Address</p>
                           <p className="font-bold text-zinc-800 dark:text-zinc-200 leading-relaxed mb-4 uppercase text-xs">{selectedClinic.address || 'No address recorded.'}</p>
                           {selectedClinic.address && <MapPreview address={selectedClinic.address} />}
                        </div>
                     </div>
                   )}

                   {activeTab === 'subscription' && (
                     <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex items-center gap-6 p-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface/50">
                           <div className="h-16 w-16 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center text-2xl shadow-sm"><FiStar /></div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Current Plan</p>
                              <p className="text-2xl font-black text-zinc-900 dark:text-white uppercase">{selectedClinic.subscription_tier || 'Free Trial'}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-6 p-6 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface/50">
                           <div className="h-16 w-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl shadow-sm"><FiCalendar /></div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Expiration Date</p>
                              <p className="text-2xl font-black text-zinc-900 dark:text-white uppercase">
                                 {selectedClinic.subscription_expires_at ? new Date(selectedClinic.subscription_expires_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Never'}
                              </p>
                           </div>
                        </div>
                     </div>
                   )}

                   {activeTab === 'admins' && (
                     <div className="animate-in fade-in duration-300">
                        {loadingAdmins ? (
                           <p className="text-sm font-black uppercase tracking-widest text-zinc-500 py-12 text-center animate-pulse">Synchronizing Staff Data...</p>
                        ) : (!clinicAdminsData.data || clinicAdminsData.data.length === 0) ? (
                           <div className="text-center py-12 bg-zinc-50 dark:bg-dark-surface rounded-2xl border border-zinc-100 dark:border-dark-border">
                              <FiUsers className="mx-auto h-8 w-8 text-zinc-300 mb-3" />
                              <p className="text-sm font-black uppercase tracking-widest text-zinc-400">No staff found.</p>
                           </div>
                        ) : (
                           <div className="space-y-4">
                              {clinicAdminsData.data.map(admin => (
                                 <div key={admin.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-sm">
                                    <div className="flex items-center gap-4">
                                       <div className="h-10 w-10 rounded-full bg-autovet-navy text-white flex items-center justify-center font-black">
                                          {admin.name.charAt(0).toUpperCase()}
                                       </div>
                                       <div>
                                          <p className="font-black text-zinc-900 dark:text-white uppercase text-xs">{admin.name}</p>
                                          <p className="text-[10px] font-bold text-zinc-500 tracking-tight">{admin.email} <span className={clsx("ml-2 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-autovet-teal text-[9px]", admin.role === 'veterinarian' ? "text-amber-600" : "text-autovet-teal")}>{admin.role.toUpperCase()}</span></p>
                                       </div>
                                    </div>
                                    <button 
                                       onClick={() => handleResetPassword(admin.id)}
                                       className="flex items-center gap-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3 py-2 text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-300 transition-colors tracking-widest border border-zinc-200 dark:border-zinc-700"
                                    >
                                       <FiLock className="h-3 w-3 text-autovet-teal" /> Reset
                                    </button>
                                 </div>
                              ))}

                              {/* Pagination for Admins */}
                              {clinicAdminsData.last_page > 1 && (
                                <div className="flex items-center justify-center gap-4 mt-6">
                                   <button 
                                     disabled={adminsPage === 1 || loadingAdmins}
                                     onClick={() => setAdminsPage(p => p - 1)}
                                     className="h-8 w-8 flex items-center justify-center rounded-lg bg-white border border-zinc-200 text-zinc-500 disabled:opacity-30"
                                   >
                                      <FiChevronLeft />
                                   </button>
                                   <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Page {adminsPage} of {clinicAdminsData.last_page}</span>
                                   <button 
                                     disabled={adminsPage === clinicAdminsData.last_page || loadingAdmins}
                                     onClick={() => setAdminsPage(p => p + 1)}
                                     className="h-8 w-8 flex items-center justify-center rounded-lg bg-white border border-zinc-200 text-zinc-500 disabled:opacity-30"
                                   >
                                      <FiChevronRight />
                                   </button>
                                </div>
                              )}
                           </div>
                        )}
                     </div>
                   )}
                </div>

                <div className="mt-10 flex gap-3 pt-6 border-t border-zinc-100 dark:border-dark-border"><button onClick={(e) => handleToggleStatus(e, selectedClinic)} className={clsx("flex-1 rounded-2xl py-4 font-black uppercase text-xs tracking-widest transition-all shadow-sm", selectedClinic.status === 'active' ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-autovet-teal/10 text-autovet-teal hover:bg-autovet-teal/20")}>{selectedClinic.status === 'active' ? 'Deactivate Clinic' : 'Activate Clinic'}</button><button onClick={() => setSelectedClinic(null)} className="flex-1 rounded-2xl bg-autovet-navy py-4 font-black uppercase text-xs tracking-widest text-white hover:opacity-90 transition-all shadow-lg">Close View</button></div>
             </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-autovet-navy/40 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl dark:bg-dark-card border dark:border-dark-border animate-in zoom-in-95 duration-200 my-8">
            <h3 className="text-2xl font-black text-autovet-navy dark:text-zinc-50 mb-6 uppercase tracking-tight">{editMode ? 'Edit Clinic Details' : 'Register New Clinic'}</h3>
            <form onSubmit={handleSubmitClinic} className="space-y-6">
              <div className="flex justify-center mb-6">
                 <div className="relative group">
                    <div className="h-24 w-24 rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-dashed border-autovet-teal/30 group-hover:border-autovet-teal transition-colors">
                       {logoPreview ? (
                         <img src={logoPreview} className="h-full w-full object-cover" alt="preview" />
                       ) : (
                         <FiImage className="h-8 w-8 text-zinc-400" />
                       )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 h-8 w-8 bg-autovet-teal rounded-xl flex items-center justify-center text-white cursor-pointer shadow-lg hover:opacity-90 transition-all">
                       <FiUpload className="h-4 w-4" />
                       <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                 </div>
              </div>
              
              <div className="space-y-4">
                 <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-dark-border pb-2">Basic Info</h4>
                 <div><label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Clinic Name *</label><input required value={formData.clinic_name} onChange={e => setFormData({...formData, clinic_name: e.target.value})} className="input-field border-autovet-navy/10 focus:border-autovet-teal uppercase text-xs font-bold" placeholder="e.g. Paw Haven Animal Hospital" /></div>
                 <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Owner Name</label><input value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} className="input-field border-autovet-navy/10 focus:border-autovet-teal uppercase text-xs font-bold" placeholder="John Doe" /></div>
                   <div><label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Email Address *</label><input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="input-field border-autovet-navy/10 focus:border-autovet-teal text-xs font-bold" placeholder="clinic@example.com" /></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Contact Number 1</label><input value={formData.contact_number} onChange={e => setFormData({...formData, contact_number: e.target.value})} className="input-field border-autovet-navy/10 focus:border-autovet-teal text-xs font-bold" placeholder="+63 ..." /></div>
                   <div><label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Contact Number 2</label><input value={formData.contact_number_2} onChange={e => setFormData({...formData, contact_number_2: e.target.value})} className="input-field border-autovet-navy/10 focus:border-autovet-teal text-xs font-bold" placeholder="+63 ..." /></div>
                 </div>
                 <div>
                   <label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Full Address</label>
                   <textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="input-field min-h-[80px] pt-3 mb-2 border-autovet-navy/10 focus:border-autovet-teal uppercase text-xs font-bold" placeholder="Street, City, Province..." />
                   <MapPreview address={debouncedAddress} />
                 </div>
              </div>

              <div className="space-y-4 pt-4">
                 <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-dark-border pb-2">Subscription & Access</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Plan Tier</label>
                       <select value={formData.subscription_tier} onChange={e => setFormData({...formData, subscription_tier: e.target.value})} className="input-field border-autovet-navy/10 focus:border-autovet-teal bg-white dark:bg-dark-surface uppercase text-[10px] font-black tracking-widest">
                          <option value="Free Trial">Free Trial</option>
                          <option value="Basic">Basic</option>
                          <option value="Premium">Premium</option>
                          <option value="Enterprise">Enterprise</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black uppercase text-autovet-navy dark:text-zinc-400 mb-1 tracking-widest">Expiration Date</label>
                       <input type="date" value={formData.subscription_expires_at} onChange={e => setFormData({...formData, subscription_expires_at: e.target.value})} className="input-field border-autovet-navy/10 focus:border-autovet-teal text-xs font-bold" />
                    </div>
                 </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-zinc-100 dark:border-dark-border mt-8"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black uppercase text-zinc-400 hover:text-autovet-navy tracking-widest text-xs">Cancel</button><button type="submit" disabled={isSubmitting} className="flex-2 rounded-2xl bg-autovet-teal px-10 py-4 font-black uppercase text-white hover:opacity-90 shadow-xl shadow-autovet-teal/20 disabled:opacity-50 tracking-widest text-xs">{isSubmitting ? 'Saving...' : (editMode ? 'Update Clinic' : 'Complete Registration')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
