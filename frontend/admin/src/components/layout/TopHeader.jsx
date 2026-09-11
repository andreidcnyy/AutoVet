import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  FiBell, FiCalendar, FiChevronDown, FiFileText, FiLogOut, FiMenu, FiUser, FiX,
  FiAlertTriangle, FiPackage, FiPlusCircle, FiCheck, FiInfo, FiActivity, FiMonitor
} from "react-icons/fi";
import DarkModeToggle from "../ui/DarkModeToggle";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import { displayUserName, roleLabel } from "../../utils/userDisplay";
import { getUserAvatarUrl } from "../../utils/userImages";
import { resolveMediaUrl, onUserImageError } from "../../utils/petImages";
import ManageDevicesModal from "../profile/ManageDevicesModal";
import clsx from "clsx";

const iconMap = {
  FiBell,
  FiAlertTriangle,
  FiPackage,
  FiPlusCircle,
  FiCheck,
  FiInfo,
  FiActivity,
  FiCalendar,
  FiFileText,
};

const iconToneStyles = {
  danger: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  info: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-dark-surface dark:text-zinc-400",
};

function TopHeader({ title, user, onMenuToggle }) {
  const isSuperAdmin = user?.role === 'super_admin';
  const toast = useToast();
  const [openProfileMenu, setOpenProfileMenu] = useState(false);
  const [openNotifMenu, setOpenNotifMenu] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const menuRef = useRef(null);
  const notifRef = useRef(null);
  const navigate = useNavigate();
  const { logout, login: setUser } = useAuth();
  const { notifications, unreadCount, markAllAsRead, dismissNotification } = useNotifications();

  const handleStopImpersonating = () => {
    const originalSession = localStorage.getItem('super_admin_session');
    if (originalSession) {
      const data = JSON.parse(originalSession);
      setUser(data);
      localStorage.removeItem('super_admin_session');
      toast.success("Returned to Super Admin account.");
      window.location.href = '/super-admin';
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setOpenNotifMenu(false);
      }
    }

    if (openProfileMenu || openNotifMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openProfileMenu, openNotifMenu]);

  return (
    <>
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur transition-colors duration-300 dark:border-dark-border dark:bg-dark-card/95">
      <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-dark-surface md:hidden"
            aria-label="Open menu"
          >
            <FiMenu className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">{title}</h1>
        </div>


        <div className="flex items-center gap-4 ml-auto">
          {localStorage.getItem('super_admin_session') && (
            <button
              onClick={handleStopImpersonating}
              className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-rose-600 hover:bg-rose-100 transition-all border border-rose-200"
            >
              <FiLogOut className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline">Stop Impersonating</span>
            </button>
          )}

          {/* Dark Mode Toggle */}
          <DarkModeToggle />

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setOpenNotifMenu(!openNotifMenu)}
              className={clsx(
                "relative rounded-lg p-2 text-zinc-500 transition-colors dark:text-zinc-400",
                openNotifMenu ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "hover:bg-zinc-100 dark:hover:bg-dark-surface"
              )}
            >
              <FiBell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-dark-card">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {openNotifMenu && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-80 rounded-2xl border border-zinc-200 bg-white shadow-2xl transition-all dark:border-dark-border dark:bg-dark-card animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-dark-border">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Notifications</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                
                <div className="max-h-[350px] overflow-y-auto slim-scroll">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <FiBell className="mb-2 h-8 w-8 text-zinc-200 dark:text-zinc-700" />
                      <p className="text-sm font-medium text-zinc-400">All caught up!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-50 dark:divide-dark-border/50">
                      {notifications.map((notif) => {
                        const Icon = iconMap[notif.iconName] || FiBell;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => { setSelectedNotif(notif); setOpenNotifMenu(false); }}
                            className="group relative flex gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-dark-surface/50 transition-colors cursor-pointer"
                          >
                            <span className={clsx(
                              "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                              iconToneStyles[notif.tone] || iconToneStyles.neutral
                            )}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{notif.title}</p>
                              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">{notif.message}</p>
                              <p className="mt-1 text-[10px] font-medium text-zinc-400 uppercase tracking-tight">{notif.time}</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); dismissNotification(notif.id); }}
                              className="absolute right-2 top-3 p-1 text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all"
                            >
                              <FiX className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Link
                  to="/notifications"
                  onClick={() => setOpenNotifMenu(false)}
                  className="block border-t border-zinc-100 py-3 text-center text-xs font-bold text-zinc-600 hover:bg-zinc-50 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface rounded-b-2xl"
                >
                  View full history
                </Link>
              </div>
            )}
          </div>

          <div ref={menuRef} className="relative border-l border-zinc-200 pl-4 dark:border-dark-border">
            <button
              type="button"
              onClick={() => setOpenProfileMenu((prev) => !prev)}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-dark-surface"
            >
              <img src={resolveMediaUrl(user?.avatar) || getUserAvatarUrl(user?.role, user?.name)}
              onError={onUserImageError(getUserAvatarUrl, user?.role, user?.name)} alt={user?.name} className="h-9 w-9 rounded-full object-cover bg-zinc-100 dark:bg-dark-surface sm:h-11 sm:w-11" />
              <div className="hidden min-w-0 text-left sm:block">
                <p className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">{displayUserName(user)}</p>
                <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{roleLabel(user?.role)}</p>
              </div>
              <FiChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </button>

            {openProfileMenu ? (
              <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-52 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-dark-border dark:bg-dark-card dark:shadow-dark-soft">
                <Link
                  to="/profile"
                  onClick={() => setOpenProfileMenu(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-dark-surface"
                >
                  <FiUser className="h-4 w-4" />
                  My Profile
                </Link>
                <button
                  type="button"
                  onClick={() => { setShowDevicesModal(true); setOpenProfileMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-dark-surface"
                >
                  <FiMonitor className="h-4 w-4" />
                  Manage Devices
                </button>
                <div className="my-1 border-t border-zinc-200 dark:border-dark-border" />
                <button
                  type="button"
                  onClick={() => {
                    toast.success("Logged out successfully.");
                    setOpenProfileMenu(false);
                    logout();
                    navigate("/login");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <FiLogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {showDevicesModal && (
        <ManageDevicesModal
          onClose={() => setShowDevicesModal(false)}
          apiBase=""
          token={user?.token || ''}
        />
      )}

    </header>
      {selectedNotif && (() => {
        const Icon = iconMap[selectedNotif.iconName] || FiBell;
        return createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedNotif(null)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-dark-border dark:bg-dark-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 p-6">
                <span className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  iconToneStyles[selectedNotif.tone] || iconToneStyles.neutral
                )}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{selectedNotif.title}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-widest font-semibold">{selectedNotif.time}</p>
                </div>
                <button onClick={() => setSelectedNotif(null)} className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-dark-surface">
                  <FiX className="h-4 w-4" />
                </button>
              </div>
              <div className="px-6 pb-4">
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{selectedNotif.message}</p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-dark-border px-6 py-4">
                {!selectedNotif.read_at && (
                  <button
                    onClick={() => { dismissNotification(selectedNotif.id); setSelectedNotif(null); }}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-emerald-700"
                  >
                    Mark as Read
                  </button>
                )}
                <button
                  onClick={() => setSelectedNotif(null)}
                  className="rounded-xl border border-zinc-200 dark:border-dark-border px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-dark-surface"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </>
  );
}

export default TopHeader;
