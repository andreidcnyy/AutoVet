import {
  FiCalendar,
  FiClipboard,
  FiCreditCard,
  FiGrid,
  FiPackage,
  FiSettings,
  FiBarChart2,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import { ROLES } from "../constants/roles";

export const primaryNavigation = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: FiGrid },
  { id: "patients", label: "Patients", path: "/patients", icon: LuPawPrint },
  { id: "appointments", label: "Appointments", path: "/appointments", icon: FiClipboard },
  { id: "inventory", label: "Inventory", path: "/inventory", icon: FiPackage, badge: "AI" },
  { id: "invoices", label: "Invoices", path: "/invoices", icon: FiCreditCard },
  { id: "reports", label: "Reports", path: "/reports", icon: FiBarChart2 },
];

export const bottomNavigation = [
  { id: "maintenance", label: "Maintenance", path: "/settings", icon: FiSettings },
];

export const clinicInfo = {
  name: "AutoVet",
  subtitle: "Clinic Manager",
};

export const currentUser = {
  name: "Dr. Sarah Smith",
  role: ROLES.VETERINARIAN,
  // Local fallback avatar — works offline. Real avatar comes from AuthContext (API).
  avatar: "/images/fallbacks/user-vet.svg",
};
