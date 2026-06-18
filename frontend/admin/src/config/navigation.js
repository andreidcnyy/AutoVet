import {
  FiCalendar,
  FiClipboard,
  FiGrid,
  FiPackage,
  FiSettings,
  FiActivity,
  FiHome,
  FiTrendingUp,
  FiVolume2,
  FiCreditCard,
  FiStar,
} from "react-icons/fi";
import { LuPawPrint, LuSparkles } from "react-icons/lu";
import { ROLES, CLINIC_STAFF_ROLES, CLINIC_ADMIN_GROUP, VET_AND_ADMIN, SUPER_ADMIN_ONLY } from "../constants/roles";
import logo from "../assets/logo.png";

export const primaryNavigation = [
  // Platform Level (Super Admin Only)
  { id: "super-dashboard", label: "Clinic Management", path: "/super-admin", icon: FiHome, allowedRoles: SUPER_ADMIN_ONLY, end: true },
  { id: "super-announcements", label: "System Broadcasts", path: "/super-admin/announcements", icon: FiVolume2, allowedRoles: SUPER_ADMIN_ONLY, end: true },
  { id: "super-logs", label: "Super Admins", path: "/super-admin/logs", icon: FiActivity, allowedRoles: SUPER_ADMIN_ONLY, end: true },
  
  // Clinic Level (Clinic Staff Only)
  { id: "dashboard", label: "Dashboard", path: "/", icon: FiGrid, allowedRoles: CLINIC_STAFF_ROLES },
  { id: "analytics", label: "Analytics", path: "/analytics", icon: FiTrendingUp, allowedRoles: CLINIC_STAFF_ROLES },
  { id: "patients", label: "Patients", path: "/patients", icon: LuPawPrint, allowedRoles: CLINIC_STAFF_ROLES },
  { id: "appointments", label: "Appointments", path: "/appointments", icon: FiClipboard, allowedRoles: CLINIC_STAFF_ROLES },
  { id: "inventory", label: "Inventory", path: "/inventory", icon: FiPackage, badge: "AI", allowedRoles: CLINIC_STAFF_ROLES },
  { id: "invoices", label: "Invoices", path: "/invoices", icon: FiCreditCard, allowedRoles: CLINIC_STAFF_ROLES },
  { id: "reviews", label: "Reviews & Feedback", path: "/settings?tab=reviews", icon: FiStar, allowedRoles: VET_AND_ADMIN },
  { id: "ai-clinical", label: "AI Clinical Support", path: "/ai-clinical", icon: LuSparkles, badge: "AI", allowedRoles: CLINIC_STAFF_ROLES, aiOnly: true },
];

export const bottomNavigation = [
  { id: "maintenance", label: "Maintenance", path: "/settings", icon: FiSettings, allowedRoles: VET_AND_ADMIN },
];

export const clinicInfo = {
  name: "Pet Wellness Animal Clinic",
  subtitle: "",
  logo: logo,
};
