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

const BACKGROUND_IMAGES = [
  "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1599443015574-be5fe8a05783?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=2070&auto=format&fit=crop"
];

const FEATURES = [
  { icon: <FiCalendar />, title: 'Easy Online Booking', desc: 'Schedule appointments anytime, anywhere with just a few clicks — no phone calls needed.' },
  { icon: <FiBell />, title: 'Real-Time Updates', desc: 'Get instant notifications about appointment status, reminders, and schedule changes.' },
  { icon: <FiFileText />, title: 'Complete Pet Profiles', desc: 'All medical records, vaccinations, and history stored securely in one place.' },
  { icon: <FiUsers />, title: 'Expert Veterinarians', desc: 'Board-certified vets dedicated to providing the best care for your beloved pets.' },
  { icon: <FiLock />, title: 'Secure & Private', desc: "Your personal data and your pet's medical history are protected with top-level security." },
  { icon: <FiShield />, title: '24/7 Portal Access', desc: 'Access your pet\'s health information, records, and appointments around the clock.' },
];

const CLINIC_SERVICES = [
  { name: 'Consultations', icon: <FiHeart />, description: 'Expert medical advice and thorough check-ups for your pets.', gradient: 'from-rose-500 to-pink-600' },
  { name: 'Grooming', icon: <FiScissors />, description: 'Professional styling and hygiene services to keep pets looking their best.', gradient: 'from-purple-500 to-violet-600' },
  { name: 'Vaccination', icon: <FiShield />, description: 'Essential preventative care and immunization schedules for lifelong health.', gradient: 'from-brand-500 to-emerald-600' },
  { name: 'Deworming', icon: <FiActivity />, description: 'Safe and effective treatments to protect your pets from internal parasites.', gradient: 'from-amber-500 to-orange-600' },
];

const STATS = [
  { value: '500+', label: 'Happy Pet Owners' },
  { value: '1,200+', label: 'Appointments Served' },
  { value: '4', label: 'Expert Veterinarians' },
  { value: '5★', label: 'Average Rating' },
];

const TESTIMONIALS = [
  {
    name: 'Maria Santos',
    pet: 'Owner of Brownie (Shih Tzu)',
    text: "The portal made everything so easy! I can book appointments and check Brownie's records anytime. The vets here truly care about our pets.",
    rating: 5,
  },
  {
    name: 'Carlo Reyes',
    pet: 'Owner of Luna (Persian Cat)',
    text: "Excellent service! I love getting notifications for Luna's vaccination schedules. The online booking system is smooth and the staff is very professional.",
    rating: 5,
  },
];

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Services', href: '#services' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

export default function Landing() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-300">

      {/* ── Navbar ── */}
      <header className={clsx(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 dark:bg-dark-card/95 backdrop-blur-md shadow-sm border-b border-zinc-200 dark:border-dark-border"
          : "bg-white/80 dark:bg-dark-card/80 backdrop-blur-md border-b border-zinc-200 dark:border-dark-border"
      )}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 hover:scale-105 transition-transform duration-300 shrink-0">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain animate-float" />
            <span className="text-base font-black tracking-tight text-zinc-800 dark:text-zinc-100 uppercase hidden lg:block">
              Pet Wellness Animal Clinic
            </span>
          </Link>

          {/* Center Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <button
                key={link.label}
                onClick={() => scrollTo(link.href)}
                className="px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 dark:hover:text-brand-500 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-surface"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Right: dark mode + auth */}
          <div className="flex items-center gap-2 shrink-0">
            <DarkModeToggle />
            <div className="h-6 w-px bg-zinc-200 dark:bg-dark-border mx-1 hidden sm:block" />
            <Link
              to="/login"
              className="hidden sm:block px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 transition-all hover:-translate-y-0.5"
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
            >
              Register
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-surface text-zinc-600 dark:text-zinc-400 transition-colors"
            >
              {mobileMenuOpen ? <FiX className="text-xl" /> : <FiMenu className="text-xl" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-dark-card border-t border-zinc-200 dark:border-dark-border px-6 py-4 space-y-1">
            {NAV_LINKS.map(link => (
              <button
                key={link.label}
                onClick={() => scrollTo(link.href)}
                className="block w-full text-left px-4 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors"
              >
                {link.label}
              </button>
            ))}
            <Link
              to="/login"
              className="block px-4 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-dark-surface transition-colors"
            >
              Log In
            </Link>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section id="home" className="relative min-h-screen flex items-center overflow-hidden pt-20">

        {/* Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/10 dark:bg-brand-500/5 rounded-full blur-[120px] animate-blob pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] animate-blob delay-500 pointer-events-none" />

        {/* Background carousel */}
        {BACKGROUND_IMAGES.map((img, index) => (
          <div
            key={img}
            className={clsx(
              "absolute inset-0 z-0 pointer-events-none transition-all duration-1000",
              index === currentImageIndex ? "opacity-20 dark:opacity-10 scale-100" : "opacity-0 scale-105"
            )}
            style={{ backgroundImage: `url("${img}")`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(2px)' }}
          />
        ))}

        {/* Paw decoratives */}
        <span className="absolute top-28 right-20 text-9xl pointer-events-none select-none opacity-5 dark:opacity-[0.03] animate-blob">🐾</span>
        <span className="absolute bottom-28 left-20 text-7xl pointer-events-none select-none opacity-5 dark:opacity-[0.03] animate-blob delay-300">🐾</span>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 w-full">
          <div className="max-w-3xl space-y-8">

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500/10 border border-brand-500/20 rounded-full text-brand-500 text-sm font-bold opacity-0 animate-fade-in-scale">
              <FiHeart /> Trusted Veterinary Care Portal
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-zinc-900 dark:text-zinc-50 leading-[1.1] tracking-tight opacity-0 animate-fade-in-scale delay-100">
              Quality Care for Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600 animate-pulse-subtle">
                Beloved Companions
              </span>
            </h1>

            <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl font-medium leading-relaxed opacity-0 animate-fade-in-scale delay-200">
              Book appointments, track your pet's health records, and stay connected with our expert veterinarians — all in one convenient portal.
            </p>

            <div className="flex flex-wrap gap-4 opacity-0 animate-fade-in-scale delay-300">
              <Link
                to="/register"
                className="group px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-black rounded-2xl flex items-center gap-3 hover:scale-105 transition-all duration-300 shadow-2xl shadow-brand-500/30 active:scale-95"
              >
                Get Started <FiArrowRight className="group-hover:translate-x-2 transition-transform" />
              </Link>
              <button
                onClick={() => scrollTo('#services')}
                className="group px-8 py-4 bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-700 dark:text-zinc-300 font-black rounded-2xl flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm"
              >
                <FiActivity className="text-brand-500 group-hover:animate-pulse" /> Our Services
              </button>
            </div>

            {/* Carousel dots */}
            <div className="flex gap-2 pt-2 opacity-0 animate-fade-in-scale delay-500">
              {BACKGROUND_IMAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  className={clsx(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === currentImageIndex ? "w-8 bg-brand-500" : "w-1.5 bg-zinc-300 dark:bg-dark-border"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="bg-brand-500 py-14">
        <div className="max-w-7xl mx-auto px-6">
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

      {/* ── Why Choose Us ── */}
      <section id="about" className="py-24 px-6 bg-white dark:bg-dark-card">
        <div className="max-w-7xl mx-auto">

          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-brand-500/10 text-brand-500 text-sm font-bold rounded-full mb-4">
              Why Choose Us
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              Everything Your Pet <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600">
                Deserves
              </span>
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-4 text-lg max-w-2xl mx-auto">
              Our portal is designed to make veterinary care simple, transparent, and accessible for every pet owner.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl border border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface hover:border-brand-500/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
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

      {/* ── Services ── */}
      <section id="services" className="py-24 px-6 bg-zinc-50 dark:bg-dark-bg">
        <div className="max-w-7xl mx-auto">

          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-brand-500/10 text-brand-500 text-sm font-bold rounded-full mb-4">
              Our Services
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              Comprehensive{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600">
                Veterinary Care
              </span>
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-4 text-lg max-w-2xl mx-auto">
              Professional veterinary care tailored to every pet's unique needs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CLINIC_SERVICES.map((service) => (
              <Link
                key={service.name}
                to="/register"
                className="group relative overflow-hidden rounded-2xl border border-zinc-100 dark:border-dark-border bg-white dark:bg-dark-card hover:shadow-xl hover:-translate-y-2 transition-all duration-300 p-6 text-center"
              >
                <div className={clsx(
                  "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-2xl mx-auto mb-4 group-hover:scale-110 transition-transform duration-300",
                  service.gradient
                )}>
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
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-6 bg-white dark:bg-dark-card">
        <div className="max-w-7xl mx-auto">

          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-brand-500/10 text-brand-500 text-sm font-bold rounded-full mb-4">
              Testimonials
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              What Pet Owners{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600">
                Are Saying
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="p-8 rounded-2xl border border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-surface hover:shadow-lg transition-all duration-300"
              >
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

      {/* ── CTA Banner ── */}
      <section className="py-24 px-6 bg-gradient-to-br from-brand-500 to-emerald-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Ready to Get Started?</h2>
          <p className="text-emerald-100 text-lg mb-10 max-w-2xl mx-auto">
            Join hundreds of pet owners who trust Pet Wellness Animal Clinic for their beloved companions' health and wellness.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="group px-10 py-4 bg-white text-brand-500 font-black rounded-2xl hover:scale-105 transition-all duration-300 shadow-2xl active:scale-95 flex items-center gap-2"
            >
              Create Free Account <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="px-10 py-4 bg-transparent border-2 border-white/50 text-white font-black rounded-2xl hover:bg-white/10 hover:scale-105 transition-all duration-300 active:scale-95"
            >
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contact" className="py-16 px-6 bg-zinc-900 dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
                <span className="text-base font-black text-white uppercase">Pet Wellness Animal Clinic</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Providing compassionate and professional veterinary care for your beloved pets. Your pet's health is our priority.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-black text-white mb-4 uppercase tracking-wider text-sm">Quick Links</h4>
              <ul className="space-y-2">
                {NAV_LINKS.map(link => (
                  <li key={link.label}>
                    <button
                      onClick={() => scrollTo(link.href)}
                      className="text-zinc-400 hover:text-brand-500 text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      <FiChevronRight className="text-xs" /> {link.label}
                    </button>
                  </li>
                ))}
                <li>
                  <Link to="/login" className="text-zinc-400 hover:text-brand-500 text-sm font-medium transition-colors flex items-center gap-1">
                    <FiChevronRight className="text-xs" /> Log In
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="text-zinc-400 hover:text-brand-500 text-sm font-medium transition-colors flex items-center gap-1">
                    <FiChevronRight className="text-xs" /> Register
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-black text-white mb-4 uppercase tracking-wider text-sm">Contact Us</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-zinc-400 text-sm">
                  <FiMail className="text-brand-500 mt-0.5 shrink-0" />
                  <span>badetvelasquez@gmail.com</span>
                </li>
                <li className="flex items-start gap-3 text-zinc-400 text-sm">
                  <FiPhone className="text-brand-500 mt-0.5 shrink-0" />
                  <span>+63 933 461 7957</span>
                </li>
                <li className="flex items-start gap-3 text-zinc-400 text-sm">
                  <FiMapPin className="text-brand-500 mt-0.5 shrink-0" />
                  <span>Blk 10 lot2D Dahlia Ave, West Fairview, Q.C. Philippines</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-8 text-center">
            <p className="text-sm text-zinc-500">
              © 2026 Digivet Management System. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
