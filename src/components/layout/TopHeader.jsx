import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiBell, FiChevronDown, FiLogOut, FiMenu, FiSearch, FiSettings, FiUser } from "react-icons/fi";
import DarkModeToggle from "../ui/DarkModeToggle";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

function TopHeader({ title, user, searchPlaceholder = "Search patients, records...", onMenuToggle }) {
  const toast = useToast();
  const [openProfileMenu, setOpenProfileMenu] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenProfileMenu(false);
      }
    }

    if (openProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openProfileMenu]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur transition-colors duration-300 dark:border-dark-border dark:bg-dark-card/95">
      <div className="grid h-20 grid-cols-2 items-center gap-4 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr_auto] lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-dark-surface md:hidden"
            aria-label="Open menu"
          >
            <FiMenu className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-3xl">{title}</h1>
        </div>

        <label className="col-span-2 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 transition-colors duration-300 dark:border-dark-border dark:bg-dark-surface dark:text-zinc-400 lg:col-span-1">
          <FiSearch className="h-4 w-4 shrink-0" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-zinc-200 dark:placeholder:text-zinc-500"
          />
        </label>

        <div className="hidden items-center gap-4 lg:flex">
          {/* Dark Mode Toggle */}
          <DarkModeToggle />

          <button
            type="button"
            onClick={() => toast.info("You have no new notifications.")}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-dark-surface"
          >
            <FiBell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          </button>

          <div ref={menuRef} className="relative border-l border-slate-200 pl-4 dark:border-dark-border">
            <button
              type="button"
              onClick={() => setOpenProfileMenu((prev) => !prev)}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-dark-surface"
            >
              <img src={user.avatar} alt={user.name} className="h-11 w-11 rounded-full object-cover" />
              <div className="min-w-0 text-left">
                <p className="truncate text-base font-semibold text-slate-900 dark:text-zinc-50">{user.name}</p>
                <p className="truncate text-sm text-slate-500 dark:text-zinc-400">{user.role}</p>
              </div>
              <FiChevronDown className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
            </button>

            {openProfileMenu ? (
              <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-dark-border dark:bg-dark-card dark:shadow-dark-soft">
                <Link
                  to="/profile"
                  onClick={() => setOpenProfileMenu(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-dark-surface"
                >
                  <FiUser className="h-4 w-4" />
                  My Profile
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setOpenProfileMenu(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-dark-surface"
                >
                  <FiSettings className="h-4 w-4" />
                  Settings
                </Link>
                <div className="my-1 border-t border-slate-200 dark:border-dark-border" />
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
