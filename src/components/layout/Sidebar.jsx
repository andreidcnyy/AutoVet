import clsx from "clsx";
import { NavLink } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";

function NavItem({ item, onClose }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      onClick={onClose}
      className={({ isActive }) =>
        clsx(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors duration-150",
          isActive
            ? "bg-blue-50 text-blue-600 dark:bg-blue-600/15 dark:text-blue-400"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-dark-surface dark:hover:text-zinc-100"
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{item.label}</span>
      {item.badge && (
        <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-600/20 dark:text-blue-400">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

function Sidebar({ items, bottomItems, clinic, isOpen, onClose }) {
  return (
    <>
      <div
        onClick={onClose}
        className={clsx(
          "fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm transition md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-all duration-300 md:translate-x-0",
          "dark:border-dark-border dark:bg-dark-card",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-dark-border">
          <div className="flex items-center gap-3">
            {clinic.logo ? (
              <img src={clinic.logo} alt="Clinic Logo" className="h-10 w-10 rounded-xl object-cover border border-slate-200 dark:border-dark-border" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400">
                <LuPawPrint className="h-5 w-5" />
              </div>
            )}
            <div>
              <p className="text-xl font-bold leading-tight text-slate-900 dark:text-zinc-50">{clinic.name}</p>
              <p className="text-sm text-slate-500 dark:text-zinc-500">{clinic.subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-dark-surface md:hidden"
            aria-label="Close menu"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 p-4">
          {items.map((item) => (
            <NavItem key={item.id} item={item} onClose={onClose} />
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-200 p-4 dark:border-dark-border">
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
