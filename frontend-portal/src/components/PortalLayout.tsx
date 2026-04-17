import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotifications } from '../api';
import { FiHome, FiCalendar, FiLogOut, FiBell, FiUser, FiPlusCircle, FiClock, FiCreditCard } from 'react-icons/fi';
import DarkModeToggle from './DarkModeToggle';
import EditProfileModal from './EditProfileModal';
import logo from '../assets/logo.png';

interface LayoutProps {
  children: ReactNode;
}

export default function PortalLayout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: FiHome },
    { name: 'Register Pet', path: '/add-pet', icon: FiPlusCircle },
    { name: 'Book Visit', path: '/book', icon: FiCalendar },
    { name: 'Visit History', path: '/appointments', icon: FiClock },
    { name: 'Invoice', path: '/invoices', icon: FiCreditCard },
    { name: 'Notifications', path: '/notifications', icon: FiBell, badge: unreadCount },
  ];

  useEffect(() => {
    if (user) {
      const fetchCount = () => {
        getNotifications().then(res => {
          const unread = res.data.filter((n: any) => !n.read_at).length;
          setUnreadCount(unread);
        }).catch(console.error);
      };

      fetchCount();
      const interval = setInterval(fetchCount, 30000); // refresh every 30s
      return () => clearInterval(interval);
    }
  }, [user, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg flex transition-colors duration-300">
      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-white dark:bg-dark-card border-r border-zinc-200 dark:border-dark-border hidden md:flex flex-col sticky top-0 h-screen transition-colors duration-300">
        <div className="p-6 text-center border-b border-zinc-100 dark:border-dark-border/50">
          <div className="flex flex-col items-center justify-center gap-3">
            <img src={logo} alt="Clinic Logo" className="w-12 h-12 object-contain" />
            <span className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-100 leading-tight">
              Pet Wellness <br/> Animal Clinic
            </span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
                location.pathname === item.path
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                  : 'text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                {item.name}
              </div>
              {item.badge > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-lg shadow-sm">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>


        <div className="p-4 mt-auto">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 space-y-3 text-center transition-colors duration-300">
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto text-lg font-bold dark:bg-brand-900/30 dark:text-brand-400">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Logged in as</p>
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 truncate">{user?.name}</p>
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
        <header className="h-16 bg-white/80 dark:bg-dark-card/80 backdrop-blur-md border-b border-zinc-200 dark:border-dark-border sticky top-0 z-10 px-8 flex items-center justify-between transition-colors duration-300">
          <div className="md:hidden flex items-center gap-2">
             <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
             <span className="text-lg font-black text-zinc-800 dark:text-zinc-100">Pet Wellness</span>
          </div>
          <div className="flex-1"></div>
          <div className="flex items-center gap-4">
            <DarkModeToggle />
            <div className="h-8 w-px bg-zinc-200 dark:bg-dark-border mx-2"></div>
            <Link to="/notifications" className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative">
              <FiBell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-dark-card"></span>
              )}
            </Link>
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-3 ml-2 hover:opacity-80 transition-opacity"
            >
              <div className="text-right hidden sm:block text-left">
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 leading-tight">{user?.name}</p>
                <p className="text-[10px] font-bold text-brand-600 uppercase tracking-tight text-right">Pet Owner</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-dark-border flex items-center justify-center overflow-hidden transition-colors">
                <FiUser className="w-6 h-6 text-zinc-400" />
              </div>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      <EditProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
    </div>
  );
}
