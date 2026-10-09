import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import logo from '../assets/logo.png';
import { PawPrint } from './Landing';

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-dark-bg overflow-hidden px-6">
      <PawPrint className="absolute -top-10 -right-10 w-72 h-72 text-brand-400 opacity-10 rotate-12 pointer-events-none" />
      <PawPrint className="absolute -bottom-10 -left-10 w-56 h-56 text-emerald-400 opacity-10 -rotate-12 pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg text-center space-y-6">
        <div className="flex justify-center">
          <img src={logo} alt="Pet Wellness" className="w-16 h-16 object-contain" />
        </div>
        <p className="text-7xl font-black text-brand-500">404</p>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-zinc-800 dark:text-zinc-100">Page not found</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            The page you're looking for doesn't exist or may have been moved.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-3 rounded-full transition-all active:scale-95"
        >
          <FiArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}
