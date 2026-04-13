import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiActivity, FiX, FiHeart, FiShield, FiScissors, FiSearch, FiLayers } from 'react-icons/fi';
import clsx from 'clsx';
import DarkModeToggle from '../components/DarkModeToggle';
import Chatbot from '../components/Chatbot';

import logo from "../assets/logo.png";

const BACKGROUND_IMAGES = [
  "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=80&w=2070&auto=format&fit=crop", // Exam room
  "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?q=80&w=2070&auto=format&fit=crop", // Vet with dog
  "https://images.unsplash.com/photo-1599443015574-be5fe8a05783?q=80&w=2070&auto=format&fit=crop", // Vet with cat
  "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?q=80&w=2070&auto=format&fit=crop", // Golden retriever
  "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=2070&auto=format&fit=crop"  // Puppies
];

const CLINIC_SERVICES = [
  { name: 'Consultations', icon: <FiHeart />, description: 'Expert medical advice and thorough check-ups for your pets.' },
  { name: 'Grooming', icon: <FiScissors />, description: 'Professional styling and hygiene services to keep pets looking their best.' },
  { name: 'Vaccination', icon: <FiShield />, description: 'Essential preventative care and immunization schedules.' },
  { name: 'Deworming', icon: <FiActivity />, description: 'Safe and effective treatments to protect your pets from internal parasites.' },
];

export default function Landing() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-300 flex flex-col relative overflow-hidden">
      {/* Background Images Carousel */}
      {BACKGROUND_IMAGES.map((img, index) => (
        <div 
          key={img}
          className={clsx(
            "absolute inset-0 z-0 scale-105 pointer-events-none transition-opacity duration-1000",
            index === currentImageIndex ? "opacity-20 dark:opacity-10" : "opacity-0"
          )}
          style={{
            backgroundImage: `url("${img}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(2px)'
          }}
        ></div>
      ))}

      {/* Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-dark-card/80 backdrop-blur-md border-b border-zinc-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative z-50">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-black tracking-tight text-zinc-800 dark:text-zinc-100 uppercase">Pet Wellness Animal Clinic</span>
          </Link>

          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <div className="h-6 w-[1px] bg-zinc-200 dark:bg-dark-border mx-2"></div>
            <Link 
              to="/login" 
              className="px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-brand-500 transition-colors"
            >
              Log In
            </Link>
            <Link 
              to="/register" 
              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all active:scale-95"
            >
              Register Now
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center pt-20 px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-10">
          {/* Hero Section */}
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h1 className="text-6xl md:text-7xl font-black text-zinc-900 dark:text-zinc-50 leading-[1.1] tracking-tight">
              Quality Care for Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-emerald-600">Beloved Companions</span>
            </h1>
            <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto font-medium leading-relaxed">
              Stay Connected with your Beloved Companions, Be Part of Our Clinic and Book with us Now!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
            <Link 
              to="/register" 
              className="group px-10 py-4 bg-emerald-950 dark:bg-zinc-100 dark:text-zinc-950 text-white font-black rounded-2xl flex items-center gap-3 hover:scale-[1.05] transition-all shadow-2xl shadow-emerald-950/20 active:scale-95"
            >
              Get Started <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="group px-10 py-4 bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border text-zinc-700 dark:text-zinc-300 font-black rounded-2xl flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-dark-surface transition-all active:scale-95 shadow-sm"
            >
              <FiActivity className="text-brand-500" /> Our Services
            </button>
          </div>
        </div>
      </main>

      {/* Services Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          ></div>
          
          <div className="card-shell relative w-full max-w-3xl bg-white dark:bg-dark-card p-8 md:p-12 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 shadow-2xl">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-dark-surface text-zinc-400 dark:text-zinc-500 transition-colors"
            >
              <FiX className="text-2xl" />
            </button>

            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">Our Clinic Services</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Professional veterinary care tailored to every pet's unique needs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {CLINIC_SERVICES.map((service) => (
                <Link 
                  key={service.name}
                  to="/register"
                  onClick={() => setIsModalOpen(false)}
                  className="flex items-start gap-5 p-5 rounded-2xl border border-zinc-100 bg-zinc-50/50 dark:border-dark-border dark:bg-dark-surface/50 hover:border-brand-500/30 hover:bg-white dark:hover:bg-dark-card transition-all group"
                >
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-white dark:bg-dark-card shadow-sm border border-zinc-100 dark:border-dark-border flex items-center justify-center text-brand-500 text-xl group-hover:scale-110 group-hover:bg-brand-500 group-hover:text-white transition-all duration-500">
                    {service.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-brand-500 transition-colors">{service.name}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-10 pt-8 border-t border-zinc-100 dark:border-dark-border text-center">
              <Link 
                to="/register"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 font-bold hover:underline"
              >
                Book a service today <FiArrowRight />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-lg font-black tracking-tighter text-zinc-800 dark:text-zinc-100 uppercase">Pet Wellness Animal Clinic</span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            © 2026 AutoVet Management System. All rights reserved.
          </p>
        </div>
      </footer>
      <Chatbot />
    </div>
  );
}
