export const getActualPetImageUrl = (photoPath) => {
  if (!photoPath) return null;
  if (photoPath.startsWith("http") || photoPath.startsWith("data:image")) return photoPath;
  return `http://localhost:8000/storage/${photoPath}`;
};

export const getPetImageUrl = (species, breed) => {
  const s = (typeof species === 'string' ? species : species?.name || '').toLowerCase();
  const b = (typeof breed === 'string' ? breed : breed?.name || '').toLowerCase();

  // Dog Breeds
  if (s.includes("dog") || s === "canine") {
    if (b.includes("golden") || b.includes("retriever")) return "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("bulldog")) return "https://images.unsplash.com/photo-1512723185835-0700e5069a9a?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("poodle")) return "https://images.unsplash.com/photo-1591768575198-88dac53fbd0a?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("german") || b.includes("shepherd")) return "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("beagle")) return "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("pug")) return "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("husky")) return "https://images.unsplash.com/photo-1513284402104-4a9ad437d25e?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("labrador")) return "https://images.unsplash.com/photo-1591769225440-811ad7d63ca5?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("shih tzu")) return "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=200&h=200";
    return "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=200&h=200"; // General Dog
  }

  // Cat Breeds
  if (s.includes("cat") || s === "feline") {
    if (b.includes("siamese")) return "https://images.unsplash.com/photo-1513245543132-31f507417b26?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("persian")) return "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("maine coon")) return "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("tabby")) return "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=200&h=200";
    if (b.includes("black")) return "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=200&h=200";
    return "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=200&h=200"; // General Cat
  }

  // Other Species
  if (s.includes("bird") || s.includes("parrot")) return "https://images.unsplash.com/photo-1522926193341-e9fed196d4c8?auto=format&fit=crop&q=80&w=200&h=200";
  if (s.includes("rabbit") || s.includes("bunny")) return "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&q=80&w=200&h=200";
  if (s.includes("hamster") || s.includes("guinea pig")) return "https://images.unsplash.com/photo-1548767791-514a36703d1b?auto=format&fit=crop&q=80&w=200&h=200";
  if (s.includes("reptile") || s.includes("snake") || s.includes("lizard")) return "https://images.unsplash.com/photo-1504450758481-7338eba7524a?auto=format&fit=crop&q=80&w=200&h=200";
  if (s.includes("fish")) return "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&q=80&w=200&h=200";

  return "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&q=80&w=200&h=200"; // Default other
};
