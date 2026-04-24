import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import echo from '../utils/echo';
import api from '../api'; // Import the central API client

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const toast = useToast();
  const achnl = useRef(null);
  const uchnl = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await api.get('/api/dashboard/notifications');
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read_at).length);
    } catch (error) {
      if (error.status !== 401) {
        console.error('Failed to fetch notifications:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications();

      const handleNewNotification = (e) => {
        toast.info(e.notification.message, { title: e.notification.title });
        fetchNotifications();
      };
      
      achnl.current = echo.private('admin.notifications');
      achnl.current.listen('.notification.created', handleNewNotification);
      
      if (user.id) {
        uchnl.current = echo.private(`notifications.${user.id}`);
        uchnl.current.listen('.notification.created', handleNewNotification);
      }

      return () => {
        echo.leave('admin.notifications');
        if (user.id) {
          echo.leave(`notifications.${user.id}`);
        }
      };
    } else {
      setIsLoading(false);
    }
  }, [user, fetchNotifications, toast]);

  const markAllAsRead = async () => {
    try {
      await api.post('/api/dashboard/notifications/mark-all-read');
      fetchNotifications(); // Refetch to get the updated state
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark notifications as read');
    }
  };

  const dismissNotification = async (id) => {
    try {
      await api.post(`/api/dashboard/notifications/${id}/dismiss`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
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
