import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight, FiActivity, FiHeart, FiShield,
  FiMail, FiPhone, FiMapPin, FiCalendar, FiBell, FiFileText,
  FiUsers, FiLock, FiChevronRight, FiMenu, FiX, FiVolume2, FiVolumeX
} from 'react-icons/fi';
import { getPublicSystemAnnouncements, getPublicReviews } from '../api';
import BroadcastBanner from '../components/BroadcastBanner';
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
const AVATAR_PET_IMAGES = [
  "https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=150&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=150&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1561037404-61cd46aa615b?q=80&w=150&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=150&auto=format&fit=crop",
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
  {
    name: 'Consultations',
    image: 'https://plus.unsplash.com/premium_photo-1661916447474-235409b19e16?q=80&w=800&auto=format&fit=crop',
    description: 'Expert medical advice and thorough check-ups for your pets.',
    badge: 'from-rose-500 to-pink-600',
  },
  {
    name: 'Grooming',
    image: 'https://plus.unsplash.com/premium_photo-1663036512129-8e236721f90d?q=80&w=800&auto=format&fit=crop',
    description: 'Professional styling and hygiene services to keep pets looking their best.',
    badge: 'from-purple-500 to-violet-600',
  },
  {
    name: 'Vaccination',
    image: 'https://plus.unsplash.com/premium_photo-1661942274165-00cc8d55a93f?q=80&w=800&auto=format&fit=crop',
    description: 'Essential preventative care and immunization schedules for lifelong health.',
    badge: 'from-brand-500 to-emerald-600',
  },
  {
    name: 'Deworming',
    image: 'https://images.unsplash.com/photo-1725409796872-8b41e8eca929?q=80&w=800&auto=format&fit=crop',
    description: 'Safe and effective treatments to protect your pets from internal parasites.',
    badge: 'from-amber-500 to-orange-600',
  },
];

const STATS = [
  { value: '500+',   label: 'Happy Pet Owners'     },
  { value: '1,200+', label: 'Appointments Served'  },
  { value: '2',      label: 'Expert Veterinarians' },
  { value: '5★',     label: 'Average Rating'       },
];

const FALLBACK_TESTIMONIALS = [
  { reviewer_name: 'Maria Santos', pet_name: 'Brownie (Shih Tzu)', body: "The portal made everything so easy! I can book appointments and check Brownie's records anytime. The vets here truly care about our pets.", rating: 5 },
  { reviewer_name: 'Carlo Reyes',  pet_name: 'Luna (Persian Cat)',  body: "Excellent service! I love getting notifications for Luna's vaccination schedules. The online booking is smooth and the staff is very professional.", rating: 5 },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled]             = useState(false);
  const [landingBanners, setLandingBanners] = useState<any[]>([]);
  const [isMuted, setIsMuted]               = useState(true);
  const [reviews, setReviews]               = useState<any[] | null>(null);
  const videoRef                            = useRef<HTMLVideoElement>(null);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    getPublicSystemAnnouncements('landing')
      .then(res => setLandingBanners(Array.isArray(res) ? res : res.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getPublicReviews()
      .then(res => setReviews(res.data?.data ?? res.data ?? []))
      .catch(() => setReviews([]));
  }, []);

  const scrollTo = (id: string) => {
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-300 overflow-x-hidden">

      {/* ══ Landing Page Broadcast Banners ══ */}
      {landingBanners.length > 0 && (
        <div className="fixed top-16 left-0 right-0 z-40 px-6 pt-3">
          <BroadcastBanner announcements={landingBanners} />
        </div>
      )}

      {/* ══════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════ */}
      <header className={clsx(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 dark:bg-dark-card/95 backdrop-blur-md shadow-sm border-b border-zinc-200/80 dark:border-dark-border"
          : "bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm border-b border-transparent"
      )}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">

          {/* Mobile: burger + dark toggle */}
          <div className="flex md:hidden items-center gap-1 shrink-0">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-surface text-zinc-600 dark:text-zinc-400 transition-colors"
            >
              {mobileMenuOpen ? <FiX className="text-xl" /> : <FiMenu className="text-xl" />}
            </button>
            <DarkModeToggle />
          </div>

          {/* Logo */}
          <Link to="/" className="hidden md:flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
            <img src={logo} alt="Logo" className="w-9 h-9 object-contain" />
            <span className="font-black text-sm text-zinc-900 dark:text-zinc-100 uppercase tracking-tight hidden lg:block">
              Pet Wellness Animal Clinic
            </span>
          </Link>

          {/* Nav pill — desktop */}
          <nav className="hidden md:flex items-center gap-0.5 bg-zinc-100 dark:bg-dark-surface rounded-full px-2 py-1.5 border border-zinc-200 dark:border-dark-border">
            {NAV_LINKS.map(link => (
              <button
                key={link.label}
                onClick={() => scrollTo(link.href)}
                className="px-4 py-1.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-full hover:bg-white dark:hover:bg-dark-card transition-all duration-200"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-3">
              <DarkModeToggle />
              <Link
                to="/login"
                className="text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 dark:hover:text-brand-400 transition-all duration-200 active:scale-95 inline-block"
              >
                Log In
              </Link>
            </div>
            <Link
              to="/register"
              className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-700 dark:hover:bg-white text-white dark:text-zinc-900 text-sm font-bold px-5 py-2.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              Register
            </Link>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-dark-card border-t border-zinc-100 dark:border-dark-border px-6 py-4 space-y-1">
            {NAV_LINKS.map(link => (
              <button
                key={link.label}
                onClick={() => scrollTo(link.href)}
                className="block w-full text-left px-4 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 rounded-xl hover:bg-zinc-50 dark:hover:bg-dark-surface transition-colors"
              >
                {link.label}
              </button>
            ))}
            <Link
              to="/login"
              className="block px-4 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 rounded-xl hover:bg-zinc-50 dark:hover:bg-dark-surface transition-all duration-200 active:scale-[0.97]"
            >
              Log In
            </Link>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════
          HERO — centered, avatar cluster
      ══════════════════════════════════════ */}
      <section id="home" className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 overflow-hidden">

        {/* Soft glow background */}
        <div className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[70%] h-[55%] bg-brand-500/5 dark:bg-brand-500/5 rounded-full blur-[150px] pointer-events-none" />

        {/* Paw decoratives */}
        <PawPrint  className="absolute top-28 right-10  w-48 h-48 text-brand-500 dark:text-emerald-400 opacity-[0.10] rotate-12  pointer-events-none animate-blob" />
        <PawPrint  className="absolute bottom-24 left-8 w-36 h-36 text-emerald-600 dark:text-emerald-400 opacity-[0.08] -rotate-20 pointer-events-none animate-blob delay-300" />
        <PawPrint  className="absolute top-1/2 right-24  w-16 h-16 text-brand-500 opacity-[0.08] rotate-45  pointer-events-none" />
        <PawTrail  className="absolute top-40 left-4    w-44 text-brand-500 dark:text-emerald-400 opacity-[0.08] -rotate-12 pointer-events-none" />
        <DogSilhouette className="absolute bottom-8 right-0 w-64 text-brand-500 dark:text-emerald-400 opacity-[0.07] pointer-events-none" />
        <CatSilhouette className="absolute top-28 left-0  w-40 text-emerald-600 dark:text-emerald-400 opacity-[0.06] pointer-events-none -scale-x-100" />

        {/* Mobile-only: logo + clinic name */}
        <div className="flex md:hidden flex-col items-center gap-3 mb-8 opacity-0 animate-fade-in-scale">
          <img src={logo} alt="Logo" className="w-24 h-24 object-contain drop-shadow-lg" />
          <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 uppercase text-center leading-tight">
            Pet Wellness Animal Clinic
          </span>
        </div>

        {/* Avatar cluster */}
        <div className="flex items-center justify-center mb-8 opacity-0 animate-fade-in-scale">
          <div className="flex -space-x-3">
            {AVATAR_PET_IMAGES.map((src, i) => (
              <img
                key={i}
                src={src}
                alt="pet"
                className="w-12 h-12 rounded-full object-cover border-[3px] border-white dark:border-dark-card shadow-md"
              />
            ))}
            <div className="w-12 h-12 rounded-full border-[3px] border-white dark:border-dark-card bg-brand-500 flex items-center justify-center shadow-md shrink-0">
              <span className="text-white text-[10px] font-black leading-tight text-center">500+</span>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-black text-zinc-900 dark:text-zinc-50 leading-[1.08] tracking-tight max-w-3xl opacity-0 animate-fade-in-scale delay-100">
          Quality Care for Your<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600">
            Beloved Companions
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed opacity-0 animate-fade-in-scale delay-200">
          Book appointments, track your pet's health records, and stay connected with our expert veterinarians — all in one convenient portal.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8 opacity-0 animate-fade-in-scale delay-300">
          <Link
            to="/register"
            className="group flex items-center gap-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-700 dark:hover:bg-white text-white dark:text-zinc-900 font-black px-8 py-4 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl shadow-zinc-900/10"
          >
            <FiCalendar className="text-brand-500 shrink-0 group-hover:rotate-12 transition-transform duration-300" />
            Book Appointment
          </Link>
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-center gap-2 mt-4 text-sm text-zinc-400 dark:text-zinc-500 opacity-0 animate-fade-in-scale delay-[400ms]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span>500+ happy pet owners and counting</span>
        </div>


      </section>

      {/* ══════════════════════════════════════
          CLINIC VIDEO SHOWCASE
      ══════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-zinc-50 dark:bg-dark-bg overflow-hidden">
        <PawPrint className="absolute -left-8 top-8  w-48 h-48 text-brand-500 dark:text-emerald-400 opacity-[0.08] rotate-12 pointer-events-none" />
        <PawPrint className="absolute -right-8 bottom-8 w-40 h-40 text-emerald-500 dark:text-emerald-400 opacity-[0.08] -rotate-12 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-brand-500/10 text-brand-500 text-sm font-bold rounded-full mb-4">See Us in Action</span>
            <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              Meet{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600">Pet Wellness Clinic</span>
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-4 text-lg max-w-2xl mx-auto">
              A warm, professional environment where every pet is treated like family.
            </p>
          </div>

          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-zinc-200/60 dark:border-dark-border bg-zinc-900">
            <video
              ref={videoRef}
              src="/petwellness.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="w-full aspect-video object-cover"
            />
            {/* Subtle gradient overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-zinc-900/60 to-transparent pointer-events-none" />
            <div className="absolute bottom-5 left-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-white text-xs font-bold drop-shadow">Pet Wellness Animal Clinic</span>
            </div>
            {/* Mute / Unmute toggle */}
            <button
              onClick={toggleMute}
              className="absolute bottom-4 right-5 flex items-center gap-1.5 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95"
            >
              {isMuted ? <FiVolumeX className="h-3.5 w-3.5" /> : <FiVolume2 className="h-3.5 w-3.5" />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
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
        <PawPrint  className="absolute -right-12 top-8    w-72 h-72 text-brand-500  dark:text-emerald-400 opacity-[0.12] dark:opacity-20 rotate-12  pointer-events-none" />
        <PawPrint  className="absolute -left-8  bottom-8  w-56 h-56 text-emerald-500 dark:text-emerald-400 opacity-[0.10] dark:opacity-20 -rotate-20 pointer-events-none" />
        <PawTrail  className="absolute top-6 left-6 w-40 text-brand-500 dark:text-emerald-400 opacity-[0.15] dark:opacity-20 pointer-events-none" />
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
                className="group relative p-6 rounded-2xl border border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface shadow-sm hover:border-brand-500/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                <PawPrint className="absolute bottom-2 right-3 w-12 h-12 text-brand-500 dark:text-emerald-400 opacity-[0.14] dark:opacity-25 rotate-12 pointer-events-none" />
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
        <CatSilhouette className="absolute left-0 bottom-0 w-56 text-brand-500 dark:text-emerald-400 opacity-[0.12] dark:opacity-20 pointer-events-none" />
        <DogSilhouette className="absolute right-0 top-6 w-64 text-emerald-600 dark:text-emerald-400 opacity-[0.12] dark:opacity-20 -scale-x-100 pointer-events-none" />
        <PawTrail      className="absolute top-6 left-1/2 -translate-x-1/2 w-56 text-brand-500 dark:text-emerald-400 opacity-[0.15] dark:opacity-20 pointer-events-none" />

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
                className="group relative overflow-hidden rounded-2xl border border-zinc-100 dark:border-dark-border bg-white dark:bg-dark-card shadow-md hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={service.image}
                    alt={service.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <span className={clsx(
                    "absolute bottom-3 left-3 px-3 py-1 rounded-full text-white text-xs font-black bg-gradient-to-r",
                    service.badge
                  )}>
                    {service.name}
                  </span>
                </div>
                <div className="p-5 text-center">
                  <h3 className="font-black text-zinc-800 dark:text-zinc-100 mb-2">{service.name}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{service.description}</p>
                  <div className="mt-4 flex items-center justify-center gap-1 text-brand-500 text-sm font-bold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                    Book Now <FiChevronRight />
                  </div>
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
        <PawPrint      className="absolute top-6   left-4   w-44 h-44 text-brand-500  dark:text-emerald-400 opacity-[0.12] dark:opacity-20 -rotate-15 pointer-events-none" />
        <PawPrint      className="absolute bottom-6 right-4  w-52 h-52 text-emerald-500 dark:text-emerald-400 opacity-[0.10] dark:opacity-20 rotate-20  pointer-events-none" />
        <CatSilhouette className="absolute top-0   right-8  w-40 text-brand-500 dark:text-emerald-400 opacity-[0.10] dark:opacity-20 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-brand-500/10 text-brand-500 text-sm font-bold rounded-full mb-4">Testimonials</span>
            <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              What Pet Owners{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600">Are Saying</span>
            </h2>
          </div>

          {(() => {
            const displayList = reviews !== null && reviews.length > 0 ? reviews : FALLBACK_TESTIMONIALS;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {displayList.map((t, idx) => (
                  <div key={t.id ?? idx} className="relative p-8 rounded-2xl border border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                    <PawPrint className="absolute bottom-3 right-4 w-16 h-16 text-brand-500 dark:text-emerald-400 opacity-[0.15] dark:opacity-25 rotate-12 pointer-events-none" />
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <span key={i} className="text-amber-400 text-lg">★</span>
                      ))}
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6 italic">"{t.body}"</p>
                    <div>
                      <div className="font-black text-zinc-800 dark:text-zinc-100">{t.reviewer_name}</div>
                      {t.pet_name && <div className="text-sm text-zinc-500 dark:text-zinc-400">Owner of {t.pet_name}</div>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
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
