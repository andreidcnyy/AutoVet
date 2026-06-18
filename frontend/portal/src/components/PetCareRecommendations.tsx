import React from 'react';
import { FiDroplet, FiActivity, FiShield, FiCheckCircle } from 'react-icons/fi';
import clsx from 'clsx';

const recommendations = [
  {
    id: 1,
    title: 'Hydration First',
    description: 'Ensure your pets always have access to clean, fresh water. Dehydration can happen quickly, especially during warm months.',
    icon: FiDroplet,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    id: 2,
    title: 'Active Playtime',
    description: 'Regular exercise is vital for physical health and mental stimulation. Aim for at least 30 minutes of play or walking daily.',
    icon: FiActivity,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    id: 3,
    title: 'Preventive Care',
    description: 'Stay updated on vaccinations and parasite control. Prevention is always better and more cost-effective than treatment.',
    icon: FiShield,
    color: 'text-rose-500',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
  },
  {
    id: 4,
    title: 'Regular Checkups',
    description: 'Annual wellness exams help catch potential health issues early. Remember to book your next routine visit!',
    icon: FiCheckCircle,
    color: 'text-brand-500',
    bg: 'bg-brand-50 dark:bg-brand-900/20',
  }
];

export default function PetCareRecommendations() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2 uppercase tracking-tight">
          <span className="text-brand-500">/</span>
          Pet Care Tips
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.map((item) => (
          <div key={item.id} className="card-shell p-5 flex gap-4 items-start h-full hover:shadow-md transition-shadow">
            <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", item.bg, item.color)}>
              <item.icon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-tight text-sm">
                {item.title}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
