import {
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiPackage,
  FiShoppingCart,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import { LuFlaskConical, LuRefreshCw } from "react-icons/lu";

export const metricCards = [
  {
    id: "appointments",
    title: "Appointments",
    value: "18",
    detail: "6 checkups scheduled in the afternoon",
    badge: "+9% this week",
    badgeTone: "success",
    icon: FiCalendar,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100",
  },
  {
    id: "pending-labs",
    title: "Pending Labs",
    value: "7",
    detail: "Awaiting pathology review",
    badge: "Needs Review",
    badgeTone: "warning",
    icon: LuFlaskConical,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100",
    accentBorder: "border-r-4 border-r-amber-400",
  },
  {
    id: "low-stock",
    title: "Low Stock",
    value: "4",
    detail: "Two anesthesia items below threshold",
    badge: "Critical",
    badgeTone: "danger",
    icon: FiAlertTriangle,
    iconColor: "text-rose-600",
    iconBg: "bg-rose-100",
    accentBorder: "border-r-4 border-r-rose-500",
  },
  {
    id: "active-patients",
    title: "Active Patients",
    value: "962",
    detail: "24 new records this month",
    icon: FiUsers,
    iconColor: "text-slate-700",
    iconBg: "bg-slate-100",
  },
];

export const inventorySeries = [
  { month: "Jan", actual: 410, forecast: 430 },
  { month: "Feb", actual: 470, forecast: 455 },
  { month: "Mar", actual: 520, forecast: 500 },
  { month: "Apr", actual: 545, forecast: 560 },
  { month: "May", actual: 615, forecast: 600 },
  { month: "Jun", actual: 660, forecast: 640 },
  { month: "Jul", actual: null, forecast: 700 },
];

export const notifications = [
  {
    id: "notif-1",
    title: "Isoflurane running low",
    message: "Current stock is below safety minimum. Restock suggestion generated.",
    time: "12 minutes ago",
    tone: "danger",
    icon: FiAlertTriangle,
  },
  {
    id: "notif-2",
    title: "Procedure room updated",
    message: "Orthopedic prep for Charlie completed by nursing team.",
    time: "49 minutes ago",
    tone: "info",
    icon: FiCalendar,
  },
  {
    id: "notif-3",
    title: "New lab panel uploaded",
    message: "Bloodwork for Nala is ready to review in patient chart.",
    time: "2 hours ago",
    tone: "success",
    icon: FiCheckCircle,
  },
  {
    id: "notif-4",
    title: "Night backup verified",
    message: "Server backup snapshot integrity check passed successfully.",
    time: "5 hours ago",
    tone: "neutral",
    icon: LuRefreshCw,
  },
];

export const dashboardActions = [
  { id: "new-appointment", label: "New Appointment", icon: FiCalendar },
  { id: "register-patient", label: "Register Patient", icon: FiUserPlus },
  { id: "order-stock", label: "Order Stock", icon: FiShoppingCart },
  { id: "export-summary", label: "Export Summary", icon: FiFileText },
  { id: "manage-inventory", label: "Manage Inventory", icon: FiPackage },
  { id: "follow-up-queue", label: "Follow-up Queue", icon: FiClock },
];
