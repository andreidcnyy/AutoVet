import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotifications, getSystemAnnouncements } from '../api';
import echo from '../utils/echo';
import { FiHome, FiCalendar, FiLogOut, FiBell, FiUser, FiPlusCircle, FiClock, FiMail, FiPhone, FiMapPin, FiCreditCard, FiMenu, FiX } from 'react-icons/fi';
import BroadcastBanner from './BroadcastBanner';
import DarkModeToggle from './DarkModeToggle';
import EditProfileModal from './EditProfileModal';
import logo from '../assets/logo.png';
import { PawPrint } from '../pages/Landing';

interface LayoutProps {
  children: ReactNode;
}

export default function PortalLayout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [banners, setBanners] = useState<any[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: FiHome },
    { name: 'Register Pet', path: '/add-pet', icon: FiPlusCircle },
    { name: 'Book Visit', path: '/book', icon: FiCalendar },
    { name: 'Visit History', path: '/appointments', icon: FiClock },
    { name: 'Notifications', path: '/notifications', icon: FiBell, badge: unreadCount },
    { name: 'Invoices', path: '/invoices', icon: FiCreditCard },
  ];

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      const fetchCount = () => {
        getNotifications().then(res => {
          const unread = res.data.filter((n: any) => !n.read_at).length;
          setUnreadCount(unread);
        }).catch(console.error);
      };

      fetchCount();
      const ch = echo.private(`notifications.${user.id}`);
      ch.listen('.notification.created', fetchCount);
      return () => ch.stopListening('.notification.created');
    }
  }, [user, location.pathname]);

  useEffect(() => {
    if (user) {
      getSystemAnnouncements()
        .then(res => setBanners(Array.isArray(res) ? res : res.data ?? []))
        .catch(() => {});
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg flex transition-colors duration-300">
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, sticky panel on desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-dark-card border-r border-zinc-200 dark:border-dark-border flex flex-col transition-all duration-300 overflow-hidden md:sticky md:top-0 md:h-screen md:z-auto ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Close button — mobile only */}
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="absolute right-3 top-3 z-10 p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
          aria-label="Close menu"
        >
          <FiX className="w-5 h-5" />
        </button>

        {/* Subtle paw decorative */}
        <PawPrint className="absolute bottom-32 right-0 w-32 h-32 text-brand-500 opacity-10 dark:opacity-[0.12] rotate-12 pointer-events-none" />
        <PawPrint className="absolute top-24 left-0 w-20 h-20 text-emerald-500 opacity-10 dark:opacity-[0.12] -rotate-12 pointer-events-none" />

        <div className="relative z-10 px-6 pb-6 pt-12 text-center border-b border-zinc-100 dark:border-dark-border/50 md:p-6">
          <div className="flex flex-col items-center justify-center gap-3">
            <img src={logo} alt="Clinic Logo" className="w-12 h-12 object-contain" />
            <span className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-100 leading-tight">
              Pet Wellness <br/> Animal Clinic
            </span>
          </div>
        </div>

        <nav className="relative z-10 flex-1 px-4 py-6 space-y-1">
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
              {item.badge !== undefined && item.badge > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-lg shadow-sm">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>


        <div className="relative z-10 p-4 mt-auto">
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
        <header className="h-16 bg-white/80 dark:bg-dark-card/80 backdrop-blur-md border-b border-zinc-200 dark:border-dark-border sticky top-0 z-10 px-4 sm:px-8 flex items-center gap-3 transition-colors duration-300">
          {/* Left: hamburger + logo + full clinic name — mobile only */}
          <div className="flex items-center gap-2 flex-1 min-w-0 md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors shrink-0"
              aria-label="Open menu"
            >
              <FiMenu className="w-5 h-5" />
            </button>
            <img src={logo} alt="Logo" className="w-7 h-7 object-contain shrink-0" />
            <span className="text-sm font-black text-zinc-800 dark:text-zinc-100 truncate">Pet Wellness Animal Clinic</span>
          </div>

          {/* Desktop spacer */}
          <div className="hidden md:flex flex-1" />

          {/* Right controls — always visible */}
          <div className="flex items-center gap-2 sm:gap-4">
            <DarkModeToggle />
            <div className="h-8 w-px bg-zinc-200 dark:bg-dark-border hidden sm:block mx-1"></div>
            <Link to="/notifications" className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative">
              <FiBell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-dark-card"></span>
              )}
            </Link>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="text-right hidden sm:block text-left">
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 leading-tight">{user?.name}</p>
                <p className="text-[10px] font-bold text-brand-600 uppercase tracking-tight text-right">Pet Owner</p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-dark-border flex items-center justify-center overflow-hidden transition-colors">
                <FiUser className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-400" />
              </div>
            </button>
          </div>
        </header>

        {/* System Broadcast Banners */}
        {banners.length > 0 && (
          <div className="px-4 sm:px-8 pt-6">
            <BroadcastBanner announcements={banners} />
          </div>
        )}

        {/* Page Content — overflow-x is pinned shut because setting only
            overflow-y makes the browser compute overflow-x as auto too, so any
            element a pixel wider than the column (a wide table, a long
            unbreakable string) gave the whole page a sideways scrollbar. */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <div className="flex flex-col min-h-full p-4 sm:p-8">
            <div className="max-w-6xl mx-auto w-full flex-1">
              {children}
            </div>

          {/* Footer information */}
          <footer className="max-w-6xl mx-auto w-full mt-16 pt-8 pb-4 text-center border-t border-zinc-100 dark:border-dark-border/50">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              Â© 2026 Digivet Management System. All rights reserved.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <FiMail className="text-brand-500/50" />
                <span>badetvelasquez@gmail.com</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FiPhone className="text-brand-500/50" />
                <span>+63 933 461 7957</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FiMapPin className="text-brand-500/50" />
                <span>Blk 10 lot2D Dahlia Ave, West Fairview, Q.C. Philippines</span>
              </div>
            </div>
          </footer>
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
