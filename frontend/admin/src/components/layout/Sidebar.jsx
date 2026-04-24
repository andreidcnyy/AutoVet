import clsx from "clsx";
import { NavLink } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";

function NavItem({ item, onClose }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.end}
      onClick={onClose}
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
      {item.badge && (
        <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-600/20 dark:text-emerald-400">
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
        <div className="border-b border-zinc-200 p-8 dark:border-dark-border">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 h-32 w-32 shrink-0">
              {clinic.logo ? (
                <img 
                  src={clinic.logo} 
                  alt="Clinic Logo" 
                  className="h-full w-full rounded-2xl object-contain shadow-xl shadow-emerald-500/10 transition-all duration-500" 
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-600/20 dark:text-emerald-400 shadow-inner">
                  <LuPawPrint className="h-16 w-16" />
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

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-dark-surface md:hidden"
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
