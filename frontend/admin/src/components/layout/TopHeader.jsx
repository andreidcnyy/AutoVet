import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  FiBell, FiChevronDown, FiLogOut, FiMenu, FiSearch, FiSettings, FiUser, FiX, 
  FiAlertTriangle, FiPackage, FiPlusCircle, FiCheck, FiInfo, FiActivity 
} from "react-icons/fi";
import DarkModeToggle from "../ui/DarkModeToggle";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import { getUserAvatarUrl } from "../../utils/userImages";
import clsx from "clsx";

const iconMap = {
  FiBell: FiBell,
  FiAlertTriangle: FiAlertTriangle,
  FiPackage: FiPackage,
  FiPlusCircle: FiPlusCircle,
  FiCheck: FiCheck,
  FiInfo: FiInfo,
  FiActivity: FiActivity,
  FiCalendar: FiPlusCircle, // Fallback for calendar icons
  FiFileText: FiInfo,       // Fallback for invoice icons
};

const iconToneStyles = {
  danger: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  info: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-dark-surface dark:text-zinc-400",
};

function TopHeader({ title, user, searchPlaceholder = "Search patients, records...", onMenuToggle }) {
  const toast = useToast();
  const [openProfileMenu, setOpenProfileMenu] = useState(false);
  const [openNotifMenu, setOpenNotifMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur transition-colors duration-300 dark:border-dark-border dark:bg-dark-card/95">
      <div className="grid h-20 grid-cols-2 items-center gap-4 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr_auto] lg:px-8">
        <div className="flex items-center gap-3">
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

        <label className="col-span-2 flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-zinc-500 transition-colors duration-300 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400 lg:col-span-1 relative">
          <FiSearch className="h-4 w-4 shrink-0" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-200 dark:placeholder:text-zinc-500 pr-8"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        <div className="hidden items-center gap-4 lg:flex">
          {localStorage.getItem('super_admin_session') && (
            <button
              onClick={handleStopImpersonating}
              className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-rose-600 hover:bg-rose-100 transition-all border border-rose-200"
            >
              <FiLogOut className="h-3 w-3" /> Stop Impersonating
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
                          <div key={notif.id} className="group relative flex gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-dark-surface/50 transition-colors">
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
                              onClick={() => dismissNotification(notif.id)}
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
              <img src={user?.avatar || getUserAvatarUrl(user?.role, user?.name)} alt={user?.name} className="h-11 w-11 rounded-full object-cover bg-zinc-100 dark:bg-dark-surface" />
              <div className="min-w-0 text-left">
                <p className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">{user?.name}</p>
                <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{user?.role}</p>
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
                <Link
                  to="/settings"
                  onClick={() => setOpenProfileMenu(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-dark-surface"
                >
                  <FiSettings className="h-4 w-4" />
                  Settings
                </Link>
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
    </header>
  );
}

export default TopHeader;
