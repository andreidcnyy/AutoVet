import { useState, useEffect } from 'react';
import { getNotifications, markNotificationAsRead } from '../api';
import echo from '../utils/echo';
import { 
  FiBell, 
  FiCheck, 
  FiInfo, 
  FiAlertCircle, 
  FiArrowLeft,
  FiClock,
  FiX
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const fetchNotifications = () => {
    setLoading(true);
    getNotifications()
      .then(res => setNotifications(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();

    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        if (user.id) {
            const channel = echo.private(`notifications.${user.id}`)
                .listen('.notification.created', (e: any) => {
                    setNotifications(prev => [e.notification, ...prev]);
                });

            return () => {
                echo.leave(`notifications.${user.id}`);
            };
        }
    }
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = (notification: any) => {
    setSelectedNotification(notification);
    setIsModalOpen(true);
    if (!notification.read_at) {
      handleMarkRead(notification.id);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read_at);
      await Promise.all(unread.map(n => markNotificationAsRead(n.id)));
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-500 hover:text-zinc-800 transition-all">
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tight text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
              <FiBell className="text-brand-500" /> Notifications
            </h1>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Stay updated with your pet's health</p>
          </div>
        </div>
        
        {notifications.some(n => !n.read_at) && (
          <button 
            onClick={handleMarkAllRead}
            className="px-4 py-2 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-widest hover:bg-brand-100 transition-all"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-24 rounded-[2rem] bg-zinc-100 dark:bg-dark-surface animate-pulse" />
          ))
        ) : notifications.length > 0 ? (
          <div className="grid gap-3">
            {notifications.map((notification) => (
              <div 
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={clsx(
                  "group relative p-6 rounded-[2rem] border-2 transition-all cursor-pointer overflow-hidden",
                  notification.read_at 
                  ? "bg-white dark:bg-dark-card/50 border-zinc-100 dark:border-dark-border opacity-70" 
                  : "bg-white dark:bg-dark-card border-brand-100 dark:border-brand-500/30 shadow-sm hover:shadow-md"
                )}
              >
                {!notification.read_at && (
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-500" />
                )}
                
                <div className="flex items-start gap-4">
                  <div className={clsx(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                    notification.read_at ? "bg-zinc-100 dark:bg-dark-surface text-zinc-400" : "bg-brand-50 dark:bg-brand-500/10 text-brand-500"
                  )}>
                    {notification.type === 'alert' ? <FiAlertCircle className="w-6 h-6" /> : <FiInfo className="w-6 h-6" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={clsx(
                        "text-sm font-black uppercase tracking-tight truncate",
                        notification.read_at ? "text-zinc-500" : "text-zinc-800 dark:text-zinc-100"
                      )}>
                        {notification.title}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                          <FiClock className="w-3 h-3" /> {new Date(notification.created_at).toLocaleDateString()}
                        </span>
                        {notification.read_at && <FiCheck className="text-emerald-500 w-4 h-4" />}
                      </div>
                    </div>
                    <p className={clsx(
                      "text-sm leading-relaxed line-clamp-2",
                      notification.read_at ? "text-zinc-400 font-medium" : "text-zinc-600 dark:text-zinc-400 font-semibold"
                    )}>
                      {notification.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-shell p-16 text-center space-y-4 bg-zinc-50/50 border-dashed">
            <div className="w-20 h-20 bg-zinc-100 dark:bg-dark-surface rounded-[2rem] mx-auto flex items-center justify-center text-zinc-300">
              <FiBell className="w-10 h-10" />
            </div>
            <div>
              <p className="text-lg font-bold text-zinc-400">Your inbox is empty</p>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1">We'll let you know when something happens</p>
            </div>
          </div>
        )}
      </div>

      {/* Notification Detail Modal */}
      {isModalOpen && selectedNotification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-white dark:bg-dark-card rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-zinc-100 dark:border-dark-border flex justify-between items-center bg-zinc-50/50 dark:bg-dark-surface/30">
              <div className="flex items-center gap-4">
                <div className={clsx(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  selectedNotification.type === 'alert' ? "bg-rose-50 text-rose-500" : "bg-brand-50 text-brand-500"
                )}>
                  {selectedNotification.type === 'alert' ? <FiAlertCircle className="w-6 h-6" /> : <FiInfo className="w-6 h-6" />}
                </div>
                <div>
                  <h2 className="text-xl font-black italic uppercase tracking-tight text-zinc-800 dark:text-zinc-100 leading-tight">
                    Notification Details
                  </h2>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                    Received on {new Date(selectedNotification.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors text-zinc-400">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-100 mb-2">
                  {selectedNotification.title}
                </h3>
                <div className="p-6 rounded-3xl bg-zinc-50 dark:bg-dark-surface/50 border border-zinc-100 dark:border-dark-border">
                  <p className="text-zinc-600 dark:text-zinc-400 font-semibold leading-relaxed">
                    {selectedNotification.message}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-full py-4 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-black uppercase tracking-widest text-xs hover:opacity-90 transition-all shadow-xl"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
