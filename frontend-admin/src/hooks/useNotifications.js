import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import echo from '../utils/echo';

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevNotificationIds = useRef(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const toast = useToast();

  const handleNewNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);

    if (notification.type === 'AiForecastUpdate' && toast.aiForecast) {
      let parsedData = {};
      try {
        parsedData = typeof notification.data === 'string'
          ? JSON.parse(notification.data)
          : (notification.data || {});
      } catch (e) { /* ignore */ }
      toast.aiForecast(parsedData);
    } else {
      toast.info(notification.message, { title: notification.title });
    }
    prevNotificationIds.current.add(notification.id);
  }, [toast.info, toast.aiForecast]);

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
        data.forEach(n => prevNotificationIds.current.add(n.id));
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.token]);

  useEffect(() => {
    if (!user?.token) return;

    fetchNotifications();

    echo.private('admin.notifications')
      .listen('.notification.created', (e) => {
        handleNewNotification(e.notification);
      });

    if (user.id) {
      echo.private(`notifications.${user.id}`)
        .listen('.notification.created', (e) => {
          handleNewNotification(e.notification);
        });
    }

    const interval = setInterval(fetchNotifications, 120000);

    return () => {
      echo.leave('admin.notifications');
      if (user.id) echo.leave(`notifications.${user.id}`);
      clearInterval(interval);
    };
  }, [user?.token, user?.id]);

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

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAllAsRead,
    dismissNotification
  };
}
