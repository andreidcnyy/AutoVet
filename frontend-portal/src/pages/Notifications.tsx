import { useState, useEffect } from 'react';
import { getNotifications, markNotificationAsRead } from '../api';
import { 
  FiBell, 
  FiCheck, 
  FiInfo, 
  FiAlertCircle, 
  FiArrowLeft,
  FiClock
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading notifications...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition font-semibold text-sm">
          <FiArrowLeft /> Dashboard
        </button>
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Latest updates
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 italic uppercase tracking-tight">
          <span className="text-brand-500 mr-2">/</span> Notification Center
        </h2>

        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map(notification => (
              <div 
                key={notification.id} 
                className={clsx(
                  "card-shell p-6 bg-white dark:bg-dark-card transition-all border-l-4",
                  notification.read_at ? "border-l-zinc-200 opacity-75" : "border-l-brand-500 shadow-md"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={clsx(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                      notification.type === 'alert' ? "bg-rose-50 text-rose-500" : "bg-brand-50 text-brand-500"
                    )}>
                      {notification.type === 'alert' ? <FiAlertCircle className="w-6 h-6" /> : <FiBell className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className={clsx(
                        "font-bold text-lg leading-tight",
                        notification.read_at ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-900 dark:text-zinc-100"
                      )}>
                        {notification.title}
                      </h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1 leading-relaxed">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-3 text-[10px] font-bold text-zinc-400 uppercase">
                        <FiClock className="w-3 h-3" />
                        {new Date(notification.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {!notification.read_at && (
                    <button 
                      onClick={() => handleMarkRead(notification.id)}
                      className="p-2 rounded-xl bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                      title="Mark as read"
                    >
                      <FiCheck className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-shell p-12 text-center text-zinc-400 bg-zinc-50/50 border-dashed">
            Your inbox is empty.
          </div>
        )}
      </div>
    </div>
  );
}
