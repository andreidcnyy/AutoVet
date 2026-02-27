import {
  FiCalendar,
  FiClipboard,
  FiCreditCard,
  FiGrid,
  FiPackage,
  FiSettings,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";

export const primaryNavigation = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: FiGrid },
  { id: "patients", label: "Patients", path: "/patients", icon: LuPawPrint },
  { id: "appointments", label: "Appointments", path: "/appointments", icon: FiClipboard },
  { id: "calendar", label: "Calendar", path: "/calendar", icon: FiCalendar },
  { id: "inventory", label: "Inventory", path: "/inventory", icon: FiPackage, badge: "AI" },
  { id: "billing", label: "Billing", path: "/billing", icon: FiCreditCard },
];

export const bottomNavigation = [
  { id: "settings", label: "Settings", path: "/settings", icon: FiSettings },
];

export const clinicInfo = {
  name: "AutoVet",
  subtitle: "Clinic Manager",
};

export const currentUser = {
  name: "Dr. Sarah Smith",
  role: "Chief Veterinarian",
  avatar:
    "https://images.unsplash.com/photo-1594824475317-17153e2013d9?auto=format&fit=crop&w=120&q=80",
};
