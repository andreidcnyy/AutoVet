import React from 'react';
import { FiActivity, FiClipboard, FiCalendar, FiUser, FiInfo } from 'react-icons/fi';
import clsx from 'clsx';

interface MedicalSummaryCardProps {
  records: any[];
  petName: string;
}

export default function MedicalSummaryCard({ records, petName }: MedicalSummaryCardProps) {
  if (!records || records.length === 0) {
    return (
      <div className="card-shell p-8 text-center bg-zinc-50/50 border-dashed dark:bg-dark-surface/30">
        <FiActivity className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
        <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No clinical history found for {petName}.</p>
      </div>
    );
  }

  // Get the latest record
  const latestRecord = records[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Clinical Note */}
        <div className="lg:col-span-2 card-shell p-6 bg-white dark:bg-dark-card border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
               <FiClipboard className="text-brand-500" /> Recent Clinical Case
             </h3>
             <span className="text-[10px] font-black uppercase bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full dark:bg-brand-900/20">
               Latest Visit
             </span>
          </div>
          
          <div className="space-y-4">
             <div>
               <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Diagnosis</p>
               <p className="text-lg font-black text-zinc-800 dark:text-zinc-100 italic">
                 {latestRecord.diagnosis || 'General Checkup'}
               </p>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="bg-zinc-50 dark:bg-dark-surface/50 p-4 rounded-2xl border border-zinc-100 dark:border-dark-border">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1">
                    <FiInfo className="w-3 h-3" /> Chief Complaint
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                    {latestRecord.chief_complaint || 'N/A'}
                  </p>
               </div>
               <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Treatment Plan</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold leading-relaxed">
                    {latestRecord.treatment_plan || 'N/A'}
                  </p>
               </div>
             </div>

             <div className="flex items-center gap-4 pt-2 border-t border-zinc-100 dark:border-dark-border mt-2">
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold uppercase tracking-tight">
                  <FiCalendar className="w-3.5 h-3.5 text-brand-500" />
                  {new Date(latestRecord.date).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold uppercase tracking-tight">
                  <FiUser className="w-3.5 h-3.5 text-brand-500" />
                  Dr. {latestRecord.vet?.name || 'Assigned Vet'}
                </div>
             </div>
          </div>
        </div>

        {/* Clinical Statistics */}
        <div className="card-shell p-6 bg-zinc-900 text-white flex flex-col justify-between">
           <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-6">Medical stats</h3>
              <div className="space-y-6">
                 <div>
                    <div className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">Total Visits</div>
                    <div className="text-4xl font-black italic">{records.length}</div>
                 </div>
                 <div className="h-px bg-white/10 w-full" />
                 <div>
                    <div className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">Primary Condition</div>
                    <div className="text-lg font-bold truncate">
                      {records.filter(r => r.diagnosis).length > 0 
                        ? records.find(r => r.diagnosis)?.diagnosis 
                        : 'N/A'}
                    </div>
                 </div>
              </div>
           </div>
           <div className="mt-8">
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-[0.2em]">Consolidated Medical Record Summary</p>
           </div>
        </div>
      </div>

      {/* History Timeline Snapshot */}
      <div className="card-shell p-6 bg-white dark:bg-dark-card">
         <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
           <FiActivity className="text-brand-500" /> Clinical History Timeline
         </h3>
         
         <div className="relative border-l-2 border-zinc-100 dark:border-dark-border ml-2 pl-6 space-y-8">
            {records.slice(0, 5).map((record, idx) => (
              <div key={record.id} className="relative">
                 <span className={clsx(
                   "absolute -left-[2.1rem] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-dark-card shadow-sm",
                   idx === 0 ? "bg-brand-500" : "bg-zinc-300 dark:bg-zinc-700"
                 )} />
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                       <p className="text-[10px] font-black text-brand-500 uppercase tracking-widest">{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                       <h4 className="font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-tight">{record.diagnosis || 'Standard Visit'}</h4>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-50 dark:bg-dark-surface/30 px-3 py-1.5 rounded-xl border border-zinc-100 dark:border-dark-border">
                       <FiUser className="w-3 h-3 text-zinc-400" />
                       <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-widest truncate max-w-[120px]">
                         Dr. {record.vet?.name || 'Vet'}
                       </span>
                    </div>
                 </div>
              </div>
            ))}
            {records.length > 5 && (
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-4">
                + {records.length - 5} more records in full history tab
              </p>
            )}
         </div>
      </div>
    </div>
  );
}
