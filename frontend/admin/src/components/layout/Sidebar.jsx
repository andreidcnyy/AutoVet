import clsx from "clsx";
import { NavLink, useLocation } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import { useNewItems } from "../../context/NewItemsContext";

function NavItem({ item, onClose }) {
  const Icon = item.icon;
  const location = useLocation();
  const { markPatientsSeen, markAppointmentsSeen } = useNewItems();

  // Suppress badge when already viewing this page (handles refresh + navigation)
  const isCurrentPage = location.pathname.startsWith(item.path) && item.path !== "/";
  const showCount = item.newCount > 0 && !isCurrentPage;

  const handleClick = () => {
    if (item.id === "patients")     markPatientsSeen();
    if (item.id === "appointments") markAppointmentsSeen();
    onClose?.();
  };

  return (
    <NavLink
      to={item.path}
      end={item.end}
      onClick={handleClick}
      className={({ isActive }) =>
        clsx(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors duration-150",
          isActive
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-600/15 dark:text-emerald-400"
            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-dark-surface dark:hover:text-zinc-100"
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{item.label}</span>
      <span className="ml-auto flex items-center gap-1">
        {item.badge && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-600/20 dark:text-emerald-400">
            {item.badge}
          </span>
        )}
        {showCount && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-600/20 dark:text-emerald-400">
            +{item.newCount}
          </span>
        )}
      </span>
    </NavLink>
  );
}

function Sidebar({ items, bottomItems, clinic, isOpen, onClose }) {
  return (
    <>
      <div
        onClick={onClose}
        className={clsx(
          "fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-sm transition md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-200 bg-white transition-all duration-300 md:translate-x-0",
          "dark:border-dark-border dark:bg-dark-card",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button — absolute top-right, mobile only */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-dark-surface md:hidden"
          aria-label="Close menu"
        >
          <FiX className="h-5 w-5" />
        </button>

        <div className="border-b border-zinc-200 px-6 pb-6 pt-14 dark:border-dark-border md:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3 h-24 w-24 shrink-0 md:mb-4 md:h-32 md:w-32">
              {clinic.logo ? (
                <img
                  src={clinic.logo}
                  alt="Clinic Logo"
                  className="h-full w-full rounded-2xl object-contain shadow-xl shadow-emerald-500/10 transition-all duration-500"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-600/20 dark:text-emerald-400 shadow-inner">
                  <LuPawPrint className="h-12 w-12 md:h-16 md:w-16" />
                </div>
              )}
            </div>
            <div className="px-2">
              <p className="text-xl font-black leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">{clinic.name}</p>
              {clinic.subtitle && (
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">{clinic.subtitle}</p>
              )}
            </div>
          </div>
        </div>

        <nav className="space-y-1 p-4">
          {items.map((item) => (
            <NavItem key={item.id} item={item} onClose={onClose} />
          ))}
        </nav>

        <div className="mt-auto border-t border-zinc-200 p-4 dark:border-dark-border">
          <nav className="space-y-1">
            {bottomItems.map((item) => (
              <NavItem key={item.id} item={item} onClose={onClose} />
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
