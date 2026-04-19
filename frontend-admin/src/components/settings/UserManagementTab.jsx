import clsx from "clsx";
import { useState, useEffect } from "react";
import { FiTrash2, FiUserPlus, FiEdit2, FiX, FiSave, FiEye, FiEyeOff } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { getUserAvatarUrl } from "../../utils/userImages";
import { ROLES } from "../../constants/roles";

export default function UserManagementTab() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetingUser, setResetingUser] = useState(null);
  const [tempPassword, setTempPassword] = useState("");
  const { user } = useAuth();

  const [formData, setFormData] = useState({ name: "", email: "", role: ROLES.STAFF, status: "active", password: "" });

  const USERS_CACHE_KEY = 'settings_users_cache';
  const CACHE_TTL = 5 * 60 * 1000;

  const fetchUsers = (signal) => {
    if (!user?.token) return;

    let hasCache = false;
    try {
      const cached = JSON.parse(localStorage.getItem(USERS_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.data)) {
        setUsers(cached.data);
        setLoading(false);
        hasCache = true;
      }
    } catch (_) {}
    if (!hasCache) setLoading(true);

    fetch("/api/users", {
      signal,
      headers: { "Accept": "application/json", "Authorization": `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => {
        const userList = Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []);
        setUsers(userList);
        try { localStorage.setItem(USERS_CACHE_KEY, JSON.stringify({ data: userList, ts: Date.now() })); } catch (_) {}
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        toast.error("Failed to load users");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);
    return () => controller.abort();
  }, [user?.token]);

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({ 
        name: user.name, 
        email: user.email, 
        role: user.role || ROLES.STAFF, 
        status: user.status?.toLowerCase() || "active", 
        password: "" 
      });
    } else {
      setEditingUser(null);
      setFormData({ name: "", email: "", role: ROLES.STAFF, status: "active", password: "" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const isEditing = !!editingUser;
    const url = isEditing ? `/api/users/${editingUser.id}` : "/api/users";
    const method = isEditing ? "PUT" : "POST";

    const payload = { ...formData };
    if (isEditing && !payload.password) {
      delete payload.password;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 422 && data.errors) {
          const firstError = Object.values(data.errors)[0][0];
          throw new Error(firstError);
        }
        throw new Error(data.message || "Failed to save user");
      }
      
      toast.success(isEditing ? "User updated" : "User created");
      fetchUsers();
      handleCloseModal();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { 
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        }
      });
      
      if (!res.ok) {
        let errorMsg = "Failed to delete";
        try {
          const data = await res.json();
          errorMsg = data.message || errorMsg;
        } catch (e) {
          // Fallback to default msg if JSON parse fails
        }
        throw new Error(errorMsg);
      }
      
      toast.success("User deleted");
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!tempPassword || tempPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      const res = await fetch(`/api/users/${resetingUser.id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify({ password: tempPassword })
      });

      if (!res.ok) throw new Error("Failed to reset password");
      toast.success("Password reset successfully");
      setResetModalOpen(false);
      setResetingUser(null);
      setTempPassword("");
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="p-6 text-zinc-500">Loading users...</div>;

  return (
    <section className="card-shell p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">User Management</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Manage real clinic staff from the database.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
          <FiUserPlus className="h-4 w-4" />
          Add New User
        </button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((member) => (
              <tr key={member.id} className="border-b border-zinc-200/80 dark:border-dark-border">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <img src={member.avatar || getUserAvatarUrl(member.role, member.name)} alt={member.name} className="h-9 w-9 rounded-full object-cover bg-zinc-100" />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{member.name}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">{member.email}</td>
                <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">{member.role}</td>
                <td className="px-4 py-4">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
                      member.status?.toLowerCase() === "active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400"
                    )}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenModal(member)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface hover:bg-zinc-100">
                      Edit
                    </button>
                    <button onClick={() => { setResetingUser(member); setResetModalOpen(true); }} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/30 hover:bg-emerald-50">
                      Reset
                    </button>
                    <button onClick={() => handleDelete(member.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/30 hover:bg-rose-50">
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-card border dark:border-dark-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{editingUser ? "Edit User" : "Add User"}</h3>
              <button onClick={handleCloseModal} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><FiX size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Role</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white">
                    <option value={ROLES.ADMIN}>Admin</option>
                    <option value={ROLES.VETERINARIAN}>Veterinarian</option>
                    <option value={ROLES.STAFF}>Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Password {editingUser && <span className="text-xs font-normal text-zinc-400">(Leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input required={!editingUser} type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full rounded-xl border border-zinc-200 p-2.5 pr-10 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 focus:outline-none dark:hover:text-zinc-300"
                  >
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-dark-border">
                <button type="button" onClick={handleCloseModal} className="px-4 py-2 font-semibold text-zinc-600 hover:text-zinc-800 dark:text-zinc-300">Cancel</button>
                <button type="submit" className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700"><FiSave/> Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-card border dark:border-dark-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Reset Password</h3>
              <button onClick={() => setResetModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><FiX size={20}/></button>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Resetting password for <strong>{resetingUser?.name}</strong>. User will be forced to change it on next login.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Temporary Password</label>
                <div className="relative">
                  <input 
                    required 
                    type={showPassword ? "text" : "password"} 
                    value={tempPassword} 
                    onChange={e => setTempPassword(e.target.value)} 
                    className="w-full rounded-xl border border-zinc-200 p-2.5 pr-10 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white" 
                    placeholder="Enter temp password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 focus:outline-none dark:hover:text-zinc-300"
                  >
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-dark-border">
                <button type="button" onClick={() => setResetModalOpen(false)} className="px-4 py-2 font-semibold text-zinc-600 hover:text-zinc-800 dark:text-zinc-300">Cancel</button>
                <button type="submit" className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700">Confirm Reset</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
