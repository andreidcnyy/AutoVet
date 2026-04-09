import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiCalendar, FiLogOut, FiBell, FiUser, FiPlusCircle } from 'react-icons/fi';
import DarkModeToggle from './DarkModeToggle';

interface LayoutProps {
  children: ReactNode;
}

export default function PortalLayout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: FiHome },
    { name: 'Register Pet', path: '/add-pet', icon: FiPlusCircle },
    { name: 'Book Visit', path: '/book', icon: FiCalendar },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex transition-colors duration-300">
      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-white dark:bg-dark-card border-r border-slate-200 dark:border-dark-border hidden md:flex flex-col sticky top-0 h-screen transition-colors duration-300">
        <div className="p-8 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/20">A</div>
            <span className="text-xl font-black tracking-tight text-slate-800 dark:text-zinc-100">AutoVet</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
                location.pathname === item.path
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                  : 'text-slate-500 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 space-y-3 text-center transition-colors duration-300">
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto text-lg font-bold dark:bg-brand-900/30 dark:text-brand-400">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Logged in as</p>
              <p className="text-sm font-bold text-slate-700 dark:text-zinc-200 truncate">{user?.name}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-lg transition-colors text-sm font-bold"
            >
              <FiLogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white/80 dark:bg-dark-card/80 backdrop-blur-md border-b border-slate-200 dark:border-dark-border sticky top-0 z-10 px-8 flex items-center justify-between transition-colors duration-300">
          <div className="md:hidden flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold">A</div>
             <span className="text-lg font-black text-slate-800 dark:text-zinc-100">AutoVet</span>
          </div>
          <div className="flex-1"></div>
          <div className="flex items-center gap-4">
            <DarkModeToggle />
            <div className="h-8 w-px bg-slate-200 dark:bg-dark-border mx-2"></div>
            <button className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors relative">
              <FiBell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-dark-card"></span>
            </button>
            <div className="flex items-center gap-3 ml-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-700 dark:text-zinc-200 leading-tight">{user?.name}</p>
                <p className="text-[10px] font-bold text-brand-600 uppercase tracking-tight">Pet Owner</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-dark-border flex items-center justify-center overflow-hidden transition-colors">
                <FiUser className="w-6 h-6 text-slate-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
