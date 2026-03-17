export const getUserAvatarUrl = (role, name) => {
  const r = role?.toLowerCase() || "";
  const n = name?.toLowerCase() || "";

  // Admin / Executive
  if (r.includes("admin")) {
    return "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150";
  }

  // Veterinarians
  if (r.includes("veterinarian") || r.includes("vet")) {
    if (n.includes("sarah") || n.includes("jenkins")) {
        return "https://images.unsplash.com/photo-1559839734-2b71f1536780?auto=format&fit=crop&q=80&w=150&h=150";
    }
    return "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=150&h=150";
  }

  // Staff / Support
  if (r.includes("staff") || r.includes("nurse") || r.includes("receptionist")) {
    return "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150&h=150";
  }

  // Default Professional Avatar
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&background=0D8ABC&color=fff&size=128`;
};
