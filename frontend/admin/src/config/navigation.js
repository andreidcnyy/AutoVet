import {
  FiCalendar,
  FiClipboard,
  FiCreditCard,
  FiGrid,
  FiPackage,
  FiSettings,
  FiActivity,
  FiHome,
  FiVolume2,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import { ROLES, CLINIC_STAFF_ROLES, CLINIC_ADMIN_GROUP, VET_AND_ADMIN, SUPER_ADMIN_ONLY } from "../constants/roles";
import logo from "../assets/logo.png";

export const primaryNavigation = [
  // Platform Level (Super Admin Only)
  { id: "super-dashboard", label: "Clinic Management", path: "/super-admin", icon: FiHome, allowedRoles: SUPER_ADMIN_ONLY, end: true },
  { id: "super-announcements", label: "System Broadcasts", path: "/super-admin/announcements", icon: FiVolume2, allowedRoles: SUPER_ADMIN_ONLY, end: true },
  { id: "super-logs", label: "System Logs", path: "/super-admin/logs", icon: FiActivity, allowedRoles: SUPER_ADMIN_ONLY, end: true },
  
  // Clinic Level (Clinic Staff Only)
  { id: "dashboard", label: "Dashboard", path: "/", icon: FiGrid, allowedRoles: CLINIC_STAFF_ROLES },
  { id: "patients", label: "Patients", path: "/patients", icon: LuPawPrint, allowedRoles: CLINIC_STAFF_ROLES },
  { id: "appointments", label: "Appointments", path: "/appointments", icon: FiClipboard, allowedRoles: CLINIC_STAFF_ROLES },
  { id: "inventory", label: "Inventory", path: "/inventory", icon: FiPackage, badge: "AI", allowedRoles: CLINIC_ADMIN_GROUP },
  { id: "invoices", label: "Invoices", path: "/invoices", icon: FiCreditCard, allowedRoles: CLINIC_ADMIN_GROUP },
];

export const bottomNavigation = [
  { id: "maintenance", label: "Maintenance", path: "/settings", icon: FiSettings, allowedRoles: CLINIC_ADMIN_GROUP },
];

export const clinicInfo = {
  name: "Pet Wellness Animal Clinic",
  subtitle: "",
  logo: logo,
};
