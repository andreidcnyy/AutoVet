import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight, FiActivity, FiHeart, FiShield, FiScissors,
  FiMail, FiPhone, FiMapPin, FiCalendar, FiBell, FiFileText,
  FiUsers, FiLock, FiChevronRight, FiMenu, FiX
} from 'react-icons/fi';
import clsx from 'clsx';
import DarkModeToggle from '../components/DarkModeToggle';
import logo from "../assets/logo.png";

/* ─────────────────────────────────────────
   Decorative SVG components
───────────────────────────────────────── */
export function PawPrint({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className}>
      <ellipse cx="50" cy="68" rx="23" ry="19" />
      <ellipse cx="24" cy="44" rx="11" ry="13" />
      <ellipse cx="43" cy="33" rx="10" ry="13" />
      <ellipse cx="63" cy="33" rx="10" ry="13" />
      <ellipse cx="79" cy="44" rx="11" ry="13" />
    </svg>
  );
}

export function PawTrail({ className = '' }: { className?: string }) {
  const paws = [
    { x: 0,   y: 60, r: -20 },
    { x: 40,  y: 20, r: 10  },
    { x: 80,  y: 60, r: -15 },
    { x: 120, y: 20, r: 12  },
  ];
  return (
    <svg viewBox="0 0 180 90" fill="currentColor" className={className}>
      {paws.map((p, i) => (
        <g key={i} transform={`translate(${p.x},${p.y}) rotate(${p.r})`}>
          <ellipse cx="15" cy="19" rx="7"   ry="6"  />
          <ellipse cx="6"  cy="11" rx="3.5" ry="4"  />
          <ellipse cx="12" cy="7"  rx="3.5" ry="4"  />
          <ellipse cx="19" cy="7"  rx="3.5" ry="4"  />
          <ellipse cx="25" cy="11" rx="3.5" ry="4"  />
        </g>
      ))}
    </svg>
  );
}

export function DogSilhouette({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 180" fill="currentColor" className={className}>
      <ellipse cx="105" cy="110" rx="65" ry="42" />
      <circle  cx="168" cy="72"  r="32" />
      <ellipse cx="192" cy="84"  rx="16" ry="11" />
      <ellipse cx="152" cy="46"  rx="13" ry="20" transform="rotate(-20 152 46)" />
      <ellipse cx="178" cy="44"  rx="11" ry="18" transform="rotate(18 178 44)"  />
      <path d="M42 95 Q14 65 22 42 Q32 20 48 38 Q36 60 52 85 Z" />
      <rect x="58"  y="142" width="16" height="34" rx="8" />
      <rect x="84"  y="145" width="16" height="34" rx="8" />
      <rect x="118" y="145" width="16" height="34" rx="8" />
      <rect x="145" y="142" width="16" height="34" rx="8" />
    </svg>
  );
}

export function CatSilhouette({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="currentColor" className={className}>
      <ellipse cx="100" cy="130" rx="55" ry="48" />
      <circle  cx="110" cy="72"  r="34" />
      <polygon points="82,46 72,18 98,38" />
      <polygon points="128,40 148,14 138,46" />
      <path d="M48 148 Q10 130 18 100 Q26 72 42 90 Q30 110 46 132 Z" />
      <rect x="64"  y="168" width="14" height="30" rx="7" />
      <rect x="86"  y="172" width="14" height="30" rx="7" />
      <rect x="112" y="172" width="14" height="30" rx="7" />
      <rect x="134" y="168" width="14" height="30" rx="7" />
    </svg>
  );
}

/* ─────────────────────────────────────────
   Data
───────────────────────────────────────── */
const BACKGROUND_IMAGES = [
  "https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=2070&auto=format&fit=crop", // golden retriever smiling
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=2070&auto=format&fit=crop", // labrador retriever
  "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=2070&auto=format&fit=crop", // two dogs running
  "https://images.unsplash.com/photo-1561037404-61cd46aa615b?q=80&w=2070&auto=format&fit=crop", // dog portrait
  "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=2070&auto=format&fit=crop", // puppy
];

const FEATURES = [
  { icon: <FiCalendar />, title: 'Easy Online Booking',   desc: 'Schedule appointments anytime, anywhere with just a few clicks — no phone calls needed.' },
  { icon: <FiBell />,     title: 'Real-Time Updates',     desc: 'Get instant notifications about appointment status, reminders, and schedule changes.'  },
  { icon: <FiFileText />, title: 'Complete Pet Profiles', desc: 'All medical records, vaccinations, and history stored securely in one place.'           },
  { icon: <FiUsers />,    title: 'Expert Veterinarians',  desc: 'Board-certified vets dedicated to providing the best care for your beloved pets.'        },
  { icon: <FiLock />,     title: 'Secure & Private',      desc: "Your personal data and your pet's medical history are protected with top-level security." },
  { icon: <FiShield />,   title: '24/7 Portal Access',    desc: "Access your pet's health information, records, and appointments around the clock."        },
];

const CLINIC_SERVICES = [
  { name: 'Consultations', icon: <FiHeart />,    description: 'Expert medical advice and thorough check-ups for your pets.',                gradient: 'from-rose-500 to-pink-600'    },
  { name: 'Grooming',      icon: <FiScissors />, description: 'Professional styling and hygiene services to keep pets looking their best.', gradient: 'from-purple-500 to-violet-600' },
  { name: 'Vaccination',   icon: <FiShield />,   description: 'Essential preventative care and immunization schedules for lifelong health.', gradient: 'from-brand-500 to-emerald-600' },
  { name: 'Deworming',     icon: <FiActivity />, description: 'Safe and effective treatments to protect your pets from internal parasites.', gradient: 'from-amber-500 to-orange-600'  },
];

const STATS = [
  { value: '500+',   label: 'Happy Pet Owners'     },
  { value: '1,200+', label: 'Appointments Served'  },
  { value: '2',      label: 'Expert Veterinarians' },
  { value: '5★',     label: 'Average Rating'       },
];

const TESTIMONIALS = [
  { name: 'Maria Santos', pet: 'Owner of Brownie (Shih Tzu)',  text: "The portal made everything so easy! I can book appointments and check Brownie's records anytime. The vets here truly care about our pets.", rating: 5 },
  { name: 'Carlo Reyes',  pet: 'Owner of Luna (Persian Cat)',  text: "Excellent service! I love getting notifications for Luna's vaccination schedules. The online booking is smooth and the staff is very professional.", rating: 5 },
];

const NAV_LINKS = [
  { label: 'Home',     href: '#home'     },
  { label: 'Services', href: '#services' },
  { label: 'About',    href: '#about'    },
  { label: 'Contact',  href: '#contact'  },
];

/* ─────────────────────────────────────────
   Page
───────────────────────────────────────── */
export default function Landing() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen]       = useState(false);
  const [scrolled, setScrolled]                   = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-300 overflow-x-hidden">

      {/* ══ Navbar ══ */}
      <header className={clsx(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 dark:bg-dark-card/95 backdrop-blur-md shadow-sm border-b border-zinc-200 dark:border-dark-border"
          : "bg-white/80 dark:bg-dark-card/80 backdrop-blur-md border-b border-zinc-200 dark:border-dark-border"
      )}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 hover:scale-105 transition-transform duration-300 shrink-0">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain animate-float" />
            <span className="text-base font-black tracking-tight text-zinc-800 dark:text-zinc-100 uppercase hidden lg:block">
              Pet Wellness Animal Clinic
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <button key={link.label} onClick={() => scrollTo(link.href)}
                className="px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 dark:hover:text-brand-500 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-surface">
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <DarkModeToggle />
            <div className="h-6 w-px bg-zinc-200 dark:bg-dark-border mx-1 hidden sm:block" />
            <Link to="/login" className="hidden sm:block px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 transition-all hover:-translate-y-0.5">
              Log In
            </Link>
            <Link to="/register" className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all hover:scale-105 active:scale-95">
              Register
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-surface text-zinc-600 dark:text-zinc-400 transition-colors">
              {mobileMenuOpen ? <FiX className="text-xl" /> : <FiMenu className="text-xl" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-dark-card border-t border-zinc-200 dark:border-dark-border px-6 py-4 space-y-1">
            {NAV_LINKS.map(link => (
              <button key={link.label} onClick={() => scrollTo(link.href)}
                className="block w-full text-left px-4 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors">
                {link.label}
              </button>
            ))}
            <Link to="/login" className="block px-4 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors">
              Log In
            </Link>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section id="home" className="relative min-h-screen flex items-center overflow-hidden pt-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/10 dark:bg-brand-500/5 rounded-full blur-[120px] animate-blob pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] animate-blob delay-500 pointer-events-none" />

        {BACKGROUND_IMAGES.map((img, index) => (
          <div key={img} className={clsx("absolute inset-0 z-0 pointer-events-none transition-all duration-1000",
            index === currentImageIndex ? "opacity-20 dark:opacity-10 scale-100" : "opacity-0 scale-105")}
            style={{ backgroundImage: `url("${img}")`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(2px)' }} />
        ))}

        {/* Paw & pet decoratives — more visible */}
        <PawPrint  className="absolute top-24 right-8  w-56 h-56 text-brand-500 opacity-20 dark:opacity-[0.08] rotate-12  pointer-events-none animate-blob" />
        <PawPrint  className="absolute bottom-20 left-6 w-40 h-40 text-emerald-600 opacity-[0.18] dark:opacity-[0.07] -rotate-20 pointer-events-none animate-blob delay-300" />
        <PawPrint  className="absolute top-1/2 right-20 w-20 h-20 text-brand-500 opacity-[0.15] dark:opacity-[0.07] rotate-45 pointer-events-none" />
        <PawTrail  className="absolute top-36 left-2   w-52 text-brand-500 opacity-[0.16] dark:opacity-[0.06] -rotate-12 pointer-events-none" />
        <DogSilhouette className="absolute bottom-10 right-0 w-80 text-brand-500 opacity-[0.12] dark:opacity-[0.05] pointer-events-none" />
        <CatSilhouette className="absolute top-24 left-0  w-44 text-emerald-600 opacity-[0.10] dark:opacity-[0.04] pointer-events-none -scale-x-100" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 w-full">
          <div className="max-w-3xl space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500/10 border border-brand-500/20 rounded-full text-brand-500 text-sm font-bold opacity-0 animate-fade-in-scale">
              <FiHeart /> Trusted Veterinary Care Portal
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-zinc-900 dark:text-zinc-50 leading-[1.1] tracking-tight opacity-0 animate-fade-in-scale delay-100">
              Quality Care for Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600 animate-pulse-subtle">Beloved Companions</span>
            </h1>
            <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl font-medium leading-relaxed opacity-0 animate-fade-in-scale delay-200">
              Book appointments, track your pet's health records, and stay connected with our expert veterinarians — all in one convenient portal.
            </p>
            <div className="flex flex-wrap gap-4 opacity-0 animate-fade-in-scale delay-300">
              <Link to="/register" className="group px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-black rounded-2xl flex items-center gap-3 hover:scale-105 transition-all duration-300 shadow-2xl shadow-brand-500/30 active:scale-95">
                Get Started <FiArrowRight className="group-hover:translate-x-2 transition-transform" />
              </Link>
              <button onClick={() => scrollTo('#services')}
                className="group px-8 py-4 bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-700 dark:text-zinc-300 font-black rounded-2xl flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm">
                <FiActivity className="text-brand-500 group-hover:animate-pulse" /> Our Services
              </button>
            </div>
            <div className="flex gap-2 pt-2 opacity-0 animate-fade-in-scale delay-500">
              {BACKGROUND_IMAGES.map((_, i) => (
                <button key={i} onClick={() => setCurrentImageIndex(i)}
                  className={clsx("h-1.5 rounded-full transition-all duration-300",
                    i === currentImageIndex ? "w-8 bg-brand-500" : "w-1.5 bg-zinc-300 dark:bg-dark-border")} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════ */}
      <section className="relative bg-brand-500 py-14 overflow-hidden">
        <PawPrint className="absolute left-4    top-1  w-16 h-16 text-white opacity-25 -rotate-12 pointer-events-none" />
        <PawPrint className="absolute left-1/4  bottom-1 w-12 h-12 text-white opacity-20  rotate-20  pointer-events-none" />
        <PawPrint className="absolute right-1/4 top-1  w-14 h-14 text-white opacity-25 -rotate-6  pointer-events-none" />
        <PawPrint className="absolute right-4   bottom-1 w-16 h-16 text-white opacity-20  rotate-15  pointer-events-none" />
        <PawTrail className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 text-white opacity-20 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <div className="text-4xl font-black text-white">{stat.value}</div>
                <div className="text-sm font-bold text-emerald-100 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          WHY CHOOSE US
      ══════════════════════════════════════ */}
      <section id="about" className="relative py-24 px-6 bg-white dark:bg-dark-card overflow-hidden">
        <PawPrint  className="absolute -right-12 top-8    w-72 h-72 text-brand-500  opacity-[0.12] dark:opacity-[0.04] rotate-12  pointer-events-none" />
        <PawPrint  className="absolute -left-8  bottom-8  w-56 h-56 text-emerald-500 opacity-[0.10] dark:opacity-[0.04] -rotate-20 pointer-events-none" />
        <PawTrail  className="absolute top-6 left-6 w-40 text-brand-500 opacity-[0.15] dark:opacity-[0.05] pointer-events-none" />
        <DogSilhouette className="absolute bottom-0 right-8 w-44 text-zinc-300 dark:text-zinc-700 opacity-40 dark:opacity-20 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-brand-500/10 text-brand-500 text-sm font-bold rounded-full mb-4">Why Choose Us</span>
            <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              Everything Your Pet <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600">Deserves</span>
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-4 text-lg max-w-2xl mx-auto">
              Our portal is designed to make veterinary care simple, transparent, and accessible for every pet owner.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title}
                className="group relative p-6 rounded-2xl border border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface hover:border-brand-500/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                <PawPrint className="absolute bottom-2 right-3 w-12 h-12 text-brand-500 opacity-[0.14] dark:opacity-[0.08] rotate-12 pointer-events-none" />
                <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500 text-2xl mb-4 group-hover:bg-brand-500 group-hover:text-white transition-all duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          SERVICES
      ══════════════════════════════════════ */}
      <section id="services" className="relative py-24 px-6 bg-zinc-50 dark:bg-dark-bg overflow-hidden">
        <CatSilhouette className="absolute left-0 bottom-0 w-56 text-brand-500 opacity-[0.12] dark:opacity-[0.05] pointer-events-none" />
        <DogSilhouette className="absolute right-0 top-6 w-64 text-emerald-600 opacity-[0.12] dark:opacity-[0.05] -scale-x-100 pointer-events-none" />
        <PawTrail      className="absolute top-6 left-1/2 -translate-x-1/2 w-56 text-brand-500 opacity-[0.15] dark:opacity-[0.06] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-brand-500/10 text-brand-500 text-sm font-bold rounded-full mb-4">Our Services</span>
            <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              Comprehensive{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600">Veterinary Care</span>
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-4 text-lg max-w-2xl mx-auto">
              Professional veterinary care tailored to every pet's unique needs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CLINIC_SERVICES.map((service) => (
              <Link key={service.name} to="/register"
                className="group relative overflow-hidden rounded-2xl border border-zinc-100 dark:border-dark-border bg-white dark:bg-dark-card hover:shadow-xl hover:-translate-y-2 transition-all duration-300 p-6 text-center">
                <PawPrint className="absolute top-2 right-2 w-10 h-10 text-zinc-500 opacity-[0.15] dark:opacity-[0.08] rotate-12 pointer-events-none" />
                <div className={clsx("w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-2xl mx-auto mb-4 group-hover:scale-110 transition-transform duration-300", service.gradient)}>
                  {service.icon}
                </div>
                <h3 className="font-black text-zinc-800 dark:text-zinc-100 mb-2">{service.name}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{service.description}</p>
                <div className="mt-4 flex items-center justify-center gap-1 text-brand-500 text-sm font-bold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  Book Now <FiChevronRight />
                </div>
              </Link>
            ))}
          </div>

          <div className="flex justify-center mt-10">
            <PawTrail className="w-52 text-brand-500 opacity-[0.18] dark:opacity-[0.08]" />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-white dark:bg-dark-card overflow-hidden">
        <PawPrint      className="absolute top-6   left-4   w-44 h-44 text-brand-500  opacity-[0.12] dark:opacity-[0.04] -rotate-15 pointer-events-none" />
        <PawPrint      className="absolute bottom-6 right-4  w-52 h-52 text-emerald-500 opacity-[0.10] dark:opacity-[0.04] rotate-20  pointer-events-none" />
        <CatSilhouette className="absolute top-0   right-8  w-40 text-brand-500 opacity-[0.10] dark:opacity-[0.04] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-brand-500/10 text-brand-500 text-sm font-bold rounded-full mb-4">Testimonials</span>
            <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              What Pet Owners{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600">Are Saying</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="relative p-8 rounded-2xl border border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface hover:shadow-lg transition-all duration-300 overflow-hidden">
                <PawPrint className="absolute bottom-3 right-4 w-16 h-16 text-brand-500 opacity-[0.15] dark:opacity-[0.07] rotate-12 pointer-events-none" />
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <span key={i} className="text-amber-400 text-lg">★</span>
                  ))}
                </div>
                <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6 italic">"{t.text}"</p>
                <div>
                  <div className="font-black text-zinc-800 dark:text-zinc-100">{t.name}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">{t.pet}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CTA BANNER
      ══════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-gradient-to-br from-brand-500 to-emerald-600 overflow-hidden">
        <PawPrint      className="absolute top-4    left-8    w-24 h-24 text-white opacity-25 -rotate-12 pointer-events-none" />
        <PawPrint      className="absolute top-8    right-16  w-20 h-20 text-white opacity-20  rotate-20  pointer-events-none" />
        <PawPrint      className="absolute bottom-4 left-1/4  w-14 h-14 text-white opacity-20  rotate-6   pointer-events-none" />
        <PawPrint      className="absolute bottom-6 right-8   w-28 h-28 text-white opacity-25 -rotate-8  pointer-events-none" />
        <PawTrail      className="absolute bottom-2 left-1/2 -translate-x-1/2 w-56 text-white opacity-20 pointer-events-none" />
        <DogSilhouette className="absolute left-0  bottom-0  w-52 text-white opacity-[0.12] pointer-events-none" />
        <CatSilhouette className="absolute right-0 bottom-0  w-44 text-white opacity-[0.12] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Ready to Get Started?</h2>
          <p className="text-emerald-100 text-lg mb-10 max-w-2xl mx-auto">
            Join hundreds of pet owners who trust Pet Wellness Animal Clinic for their beloved companions' health and wellness.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/register"
              className="group px-10 py-4 bg-white text-brand-500 font-black rounded-2xl hover:scale-105 transition-all duration-300 shadow-2xl active:scale-95 flex items-center gap-2">
              Create Free Account <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/login"
              className="px-10 py-4 bg-transparent border-2 border-white/50 text-white font-black rounded-2xl hover:bg-white/10 hover:scale-105 transition-all duration-300 active:scale-95">
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer id="contact" className="relative py-16 px-6 bg-zinc-900 dark:bg-zinc-950 overflow-hidden">
        <PawPrint className="absolute top-6  right-10 w-24 h-24 text-brand-500 opacity-[0.12] rotate-12  pointer-events-none" />
        <PawPrint className="absolute bottom-6 left-10 w-20 h-20 text-brand-500 opacity-[0.10] -rotate-10 pointer-events-none" />
        <PawTrail className="absolute bottom-2 right-1/4 w-40 text-white opacity-[0.07] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
                <span className="text-base font-black text-white uppercase">Pet Wellness Animal Clinic</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Providing compassionate and professional veterinary care for your beloved pets. Your pet's health is our priority.
              </p>
              <PawTrail className="mt-4 w-32 text-brand-500 opacity-30" />
            </div>

            <div>
              <h4 className="font-black text-white mb-4 uppercase tracking-wider text-sm">Quick Links</h4>
              <ul className="space-y-2">
                {NAV_LINKS.map(link => (
                  <li key={link.label}>
                    <button onClick={() => scrollTo(link.href)}
                      className="text-zinc-400 hover:text-brand-500 text-sm font-medium transition-colors flex items-center gap-1">
                      <FiChevronRight className="text-xs" /> {link.label}
                    </button>
                  </li>
                ))}
                <li><Link to="/login"    className="text-zinc-400 hover:text-brand-500 text-sm font-medium transition-colors flex items-center gap-1"><FiChevronRight className="text-xs" /> Log In</Link></li>
                <li><Link to="/register" className="text-zinc-400 hover:text-brand-500 text-sm font-medium transition-colors flex items-center gap-1"><FiChevronRight className="text-xs" /> Register</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-black text-white mb-4 uppercase tracking-wider text-sm">Contact Us</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-zinc-400 text-sm"><FiMail  className="text-brand-500 mt-0.5 shrink-0" /><span>badetvelasquez@gmail.com</span></li>
                <li className="flex items-start gap-3 text-zinc-400 text-sm"><FiPhone className="text-brand-500 mt-0.5 shrink-0" /><span>+63 933 461 7957</span></li>
                <li className="flex items-start gap-3 text-zinc-400 text-sm"><FiMapPin className="text-brand-500 mt-0.5 shrink-0" /><span>Blk 10 lot2D Dahlia Ave, West Fairview, Q.C. Philippines</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">© 2026 Digivet Management System. All rights reserved.</p>
            <div className="flex items-center gap-2 opacity-40">
              {[0, 1, 2, 3].map(i => (
                <PawPrint key={i} className={clsx("w-5 h-5 text-brand-500", i % 2 === 0 ? "rotate-12" : "-rotate-12")} />
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
