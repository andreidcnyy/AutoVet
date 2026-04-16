import React, { useState, useEffect } from "react";
import { FiBell, FiCheck, FiFilter, FiArrowLeft, FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import clsx from "clsx";

const iconToneStyles = {
  danger: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  info: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-dark-surface dark:text-zinc-400",
};

function NotificationHistoryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, unread, read

  const fetchNotifications = () => {
    setLoading(true);
    fetch("/api/dashboard/notifications", {
      headers: {
        "Authorization": `Bearer ${user?.token}`,
        "Accept": "application/json"
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch notifications");
        return res.json();
      })
      .then((data) => setNotifications(data))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = () => {
    fetch("/api/dashboard/notifications/mark-all-read", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${user?.token}`,
        "Accept": "application/json"
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Action failed");
        setNotifications([]);
        toast.success("All notifications marked as read");
      })
      .catch((err) => toast.error(err.message));
  };

  const markAsRead = async (ids) => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    
    try {
      await Promise.all(idArray.map(id => 
        fetch(`/api/dashboard/notifications/${id}/dismiss`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${user?.token}`,
            "Accept": "application/json"
          }
        })
      ));
      
      setNotifications((prev) => prev.filter((n) => !idArray.includes(n.id)));
      toast.success(idArray.length > 1 ? "Notifications dismissed" : "Notification dismissed");
    } catch (err) {
      toast.error("Failed to dismiss some notifications");
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read_at;
    if (filter === "read") return !!n.read_at;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => navigate(-1)}
          className="group flex w-fit items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
        >
          <FiArrowLeft className="transition-transform group-hover:-translate-x-1" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
            <FiBell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Notification Center</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Manage your alerts and system updates</p>
          </div>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-dark-surface dark:text-zinc-300 dark:hover:bg-dark-surface/70 transition-colors"
            >
              <FiCheck /> Mark all as read
            </button>
          )}
        </div>
      </div>

      <div className="card-shell overflow-hidden flex flex-col min-h-[500px]">
        <div className="flex items-center gap-4 border-b border-zinc-200 px-6 py-4 dark:border-dark-border">
          <button
            onClick={() => setFilter("all")}
            className={clsx(
              "px-3 py-1 text-sm font-bold rounded-lg transition-colors",
              filter === "all" ? "bg-emerald-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-dark-surface"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={clsx(
              "px-3 py-1 text-sm font-bold rounded-lg transition-colors flex items-center gap-2",
              filter === "unread" ? "bg-emerald-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-dark-surface"
            )}
          >
            Unread
            {unreadCount > 0 && <span className={clsx("h-2 w-2 rounded-full", filter === "unread" ? "bg-white" : "bg-emerald-500")} />}
          </button>
          <button
            onClick={() => setFilter("read")}
            className={clsx(
              "px-3 py-1 text-sm font-bold rounded-lg transition-colors",
              filter === "read" ? "bg-emerald-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-dark-surface"
            )}
          >
            Read
          </button>
        </div>

        <div className="flex-1 overflow-y-auto slim-scroll">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-zinc-400">Loading notifications...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-zinc-400">
              <FiBell className="mb-2 h-10 w-10 opacity-20" />
              <p>No notifications to display</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-dark-border">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={clsx(
                    "group relative flex gap-4 px-6 py-5 transition-colors",
                    !notif.read_at && "bg-emerald-50/30 dark:bg-emerald-900/5"
                  )}
                >
                  <div
                    className={clsx(
                      "mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                      iconToneStyles[notif.type] || iconToneStyles.neutral
                    )}
                  >
                    <FiBell className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <h4 className={clsx("text-lg font-bold leading-tight", !notif.read_at ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400")}>
                        {notif.message}
                      </h4>
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest whitespace-nowrap ml-4">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                       <span className={clsx(
                         "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                         notif.read_at ? "bg-zinc-100 text-zinc-400 dark:bg-dark-surface" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                       )}>
                         {notif.read_at ? "Read" : "Unread"}
                       </span>
                       
                       {!notif.read_at && (
                         <button
                           onClick={() => markAsRead([notif.id])}
                           className="text-xs font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
                         >
                           Mark as read
                         </button>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationHistoryPage;
