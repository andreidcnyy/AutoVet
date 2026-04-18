import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevNotificationIds = useRef(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const toast = useToast();

  const fetchNotifications = useCallback(async () => {
    if (!user?.token) return;
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard/notifications', {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.length);

        // Check for new AiForecastUpdate notifications
        data.forEach(notification => {
            if (!prevNotificationIds.current.has(notification.id)) {
                if (notification.type === 'AiForecastUpdate' && toast.aiForecast) {
                    let parsedData = {};
                    try {
                        parsedData = typeof notification.data === 'string' ? JSON.parse(notification.data) : (notification.data || {});
                    } catch (e) {
                         // ignore
                    }
                    toast.aiForecast(parsedData);
                }
                prevNotificationIds.current.add(notification.id);
            }
        });
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.token]);

  const markAllAsRead = async () => {
    if (!user?.token) return;
    
    try {
      const res = await fetch('/api/dashboard/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (res.ok) {
        setNotifications([]);
        setUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark notifications as read');
    }
  };

  const dismissNotification = async (id) => {
    if (!user?.token) return;
    
    try {
      const res = await fetch(`/api/dashboard/notifications/${id}/dismiss`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Optional: Refresh every 2 minutes
    const interval = setInterval(fetchNotifications, 120000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAllAsRead,
    dismissNotification
  };
}
