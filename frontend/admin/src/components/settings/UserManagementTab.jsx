import clsx from "clsx";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FiTrash2, FiUserPlus, FiEdit2, FiX, FiSave, FiEye, FiEyeOff } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { getUserAvatarUrl } from "../../utils/userImages";
import { resolveMediaUrl, onUserImageError } from "../../utils/petImages";
import { ROLES } from "../../constants/roles";
import echo from "../../utils/echo";

const isSuperAdmin = (role) => role === ROLES.SUPER_ADMIN;

// Normalize status to Title Case for consistent storage + display
const normalizeStatus = (s) => {
  if (!s) return "Active";
  const lower = s.toLowerCase();
  return lower === "inactive" ? "Inactive" : "Active";
};

const USERS_CACHE_KEY = "settings_users_cache";
const USERS_UPDATED_EVENT = "users-updated";

export default function UserManagementTab() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetingUser, setResetingUser] = useState(null);
  const [tempPassword, setTempPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: "", email: "", role: ROLES.STAFF, status: "Active", password: "",
  });

  const fetchUsers = (signal, force = false) => {
    if (!user?.token) return;

    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(USERS_CACHE_KEY) || "null");
        if (cached && Date.now() - cached.ts < 5 * 60 * 1000 && Array.isArray(cached.data)) {
          setUsers(cached.data);
          setLoading(false);
          return;
        }
      } catch (_) {}
    }

    setLoading(true);
    fetch("/api/users", {
      signal,
      headers: { Accept: "application/json", Authorization: `Bearer ${user.token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setUsers(list);
        try {
          localStorage.setItem(USERS_CACHE_KEY, JSON.stringify({ data: list, ts: Date.now() }));
        } catch (_) {}
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load users");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal, true);

    const onVisible = () => { if (document.visibilityState === "visible") fetchUsers(undefined, true); };
    const onUsersUpdated = () => fetchUsers(undefined, true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(USERS_UPDATED_EVENT, onUsersUpdated);
    const ch = echo.private('admin.notifications');
    ch.listen('.entity.created', onUsersUpdated).listen('.portal.status.changed', onUsersUpdated);

    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(USERS_UPDATED_EVENT, onUsersUpdated);
      ch.stopListening('.entity.created').stopListening('.portal.status.changed');
    };
  }, [user?.token]);

  const handleOpenModal = (member = null) => {
    setShowPassword(false);
    if (member) {
      setEditingUser(member);
      setFormData({
        name: member.name,
        email: member.email,
        role: member.role || ROLES.STAFF,
        status: normalizeStatus(member.status),
        password: "",
      });
    } else {
      setEditingUser(null);
      setFormData({ name: "", email: "", role: ROLES.STAFF, status: "Active", password: "" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setShowPassword(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const isEditing = !!editingUser;
    const url = isEditing ? `/api/users/${editingUser.id}` : "/api/users";
    const method = isEditing ? "PUT" : "POST";

    const payload = { ...formData };
    if (isEditing && !payload.password) delete payload.password;

    setSaving(true);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.errors) {
          throw new Error(Object.values(data.errors)[0][0]);
        }
        throw new Error(data.message || "Failed to save user");
      }

      // Optimistic update — reflect change immediately without waiting for refetch
      if (isEditing) {
        setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)));
      } else {
        setUsers((prev) => [...prev, data]);
      }

      // Bust cache so next poll fetches fresh data
      localStorage.removeItem(USERS_CACHE_KEY);

      // Broadcast so other tabs / components re-sync
      window.dispatchEvent(new CustomEvent(USERS_UPDATED_EVENT));

      toast.success(isEditing ? "User updated successfully." : "User created successfully.");
      handleCloseModal();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${user?.token}` },
      });

      if (!res.ok) {
        let msg = "Failed to delete";
        try { msg = (await res.json()).message || msg; } catch (_) {}
        throw new Error(msg);
      }

      // Optimistic removal
      setUsers((prev) => prev.filter((u) => u.id !== id));
      localStorage.removeItem(USERS_CACHE_KEY);
      window.dispatchEvent(new CustomEvent(USERS_UPDATED_EVENT));
      toast.success("User deleted.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!tempPassword || tempPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${resetingUser.id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ password: tempPassword }),
      });

      if (!res.ok) throw new Error("Failed to reset password.");
      toast.success("Password reset successfully.");
      setResetModalOpen(false);
      setResetingUser(null);
      setTempPassword("");
      setShowTempPassword(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const visibleUsers = isSuperAdmin(user?.role)
    ? users
    : users.filter((u) => u.role !== ROLES.SUPER_ADMIN);

  if (loading) return <div className="p-6 text-zinc-500">Loading users...</div>;

  return (
    <section className="card-shell p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">User Management</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Manage real clinic staff from the database.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
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
            {visibleUsers.map((member) => (
              <tr key={member.id} className="border-b border-zinc-200/80 dark:border-dark-border">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={resolveMediaUrl(member.avatar) || getUserAvatarUrl(member.role, member.name)}
                      onError={onUserImageError(getUserAvatarUrl, member.role, member.name)}
                      alt={member.name}
                      className="h-9 w-9 rounded-full object-cover bg-zinc-100"
                    />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{member.name}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">{member.email}</td>
                <td className="px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">{member.role}</td>
                <td className="px-4 py-4">
                  <span
                    className={clsx(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
                      normalizeStatus(member.status) === "Active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400"
                    )}
                  >
                    {normalizeStatus(member.status)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenModal(member)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface hover:bg-zinc-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { setResetingUser(member); setShowTempPassword(false); setTempPassword(""); setResetModalOpen(true); }}
                      className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/30 hover:bg-emerald-50"
                    >
                      Reset
                    </button>
                    {(!isSuperAdmin(member.role) || isSuperAdmin(user?.role)) && (
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/30 hover:bg-rose-50"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[10200] flex items-center justify-center bg-zinc-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-card border dark:border-dark-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                {editingUser ? "Edit User" : "Add User"}
              </h3>
              <button onClick={handleCloseModal} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                  >
                    {isSuperAdmin(user?.role) && (
                      <option value={ROLES.SUPER_ADMIN}>Super Admin</option>
                    )}
                    <option value={ROLES.CLINIC_ADMIN}>Clinic Admin</option>
                    <option value={ROLES.VETERINARIAN}>Veterinarian</option>
                    <option value={ROLES.STAFF}>Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Password{" "}
                  {editingUser && (
                    <span className="text-xs font-normal text-zinc-400">(Leave blank to keep current)</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    required={!editingUser}
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-xl border border-zinc-200 p-2.5 pr-10 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 focus:outline-none dark:hover:text-zinc-300"
                  >
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-dark-border">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 font-semibold text-zinc-600 hover:text-zinc-800 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <FiSave /> {saving ? "Saving..." : "Save User"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Reset Password Modal */}
      {resetModalOpen && createPortal(
        <div className="fixed inset-0 z-[10200] flex items-center justify-center bg-zinc-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-card border dark:border-dark-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Reset Password</h3>
              <button
                onClick={() => { setResetModalOpen(false); setResetingUser(null); setTempPassword(""); }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <FiX size={20} />
              </button>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Resetting password for <strong>{resetingUser?.name}</strong>. The user will be required to change it on next login.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Temporary Password
                </label>
                <div className="relative">
                  <input
                    required
                    type={showTempPassword ? "text" : "password"}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 p-2.5 pr-10 text-sm focus:border-emerald-500 focus:outline-none dark:bg-dark-surface dark:border-dark-border dark:text-white"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTempPassword((p) => !p)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 focus:outline-none dark:hover:text-zinc-300"
                  >
                    {showTempPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-dark-border">
                <button
                  type="button"
                  onClick={() => { setResetModalOpen(false); setResetingUser(null); setTempPassword(""); }}
                  className="px-4 py-2 font-semibold text-zinc-600 hover:text-zinc-800 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
