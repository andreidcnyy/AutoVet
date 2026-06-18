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
      <div className="card-shell p-12 text-center bg-zinc-50/50 border-dashed dark:bg-dark-surface/30">
        <FiActivity className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
        <p className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em]">No clinical history found for {petName}</p>
      </div>
    );
  }

  // Get the latest record
  const latestRecord = records[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Latest Clinical Note */}
        <div className="lg:col-span-8 card-shell p-6 bg-white dark:bg-dark-card border-l-4 border-l-brand-500 flex flex-col">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
               <FiClipboard className="text-brand-500 w-4 h-4" /> Recent Clinical Case
             </h3>
             <span className="text-[9px] font-black uppercase bg-brand-500 text-white px-3 py-1 rounded-full shadow-lg shadow-brand-500/20">
               Latest Entry
             </span>
          </div>
          
          <div className="space-y-6 flex-1">
             <div>
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Final Diagnosis</p>
               <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50 italic uppercase tracking-tight leading-tight">
                 {latestRecord.diagnosis || 'General Checkup'}
               </p>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="bg-zinc-50 dark:bg-dark-surface/50 p-5 rounded-[1.5rem] border border-zinc-100 dark:border-dark-border">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <FiInfo className="w-3 h-3 text-brand-500" /> Chief Complaint
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                    {latestRecord.chief_complaint || 'N/A'}
                  </p>
               </div>
               <div className="bg-emerald-50/30 dark:bg-emerald-900/10 p-5 rounded-[1.5rem] border border-emerald-100 dark:border-emerald-900/20">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Treatment Plan</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-bold leading-relaxed italic">
                    {latestRecord.treatment_plan || 'N/A'}
                  </p>
               </div>
             </div>
          </div>

          <div className="flex items-center gap-6 pt-6 border-t border-zinc-100 dark:border-dark-border mt-6">
             <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                   <FiCalendar className="w-4 h-4 text-brand-500" />
                </div>
                <div>
                   <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Visit Date</p>
                   <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">{new Date(latestRecord.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
             </div>
             <div className="flex items-center gap-2 border-l border-zinc-100 dark:border-dark-border pl-6">
                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                   <FiUser className="w-4 h-4 text-brand-500" />
                </div>
                <div>
                   <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Attending Vet</p>
                   <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">Dr. {latestRecord.vet?.name || 'Assigned Vet'}</p>
                </div>
             </div>
          </div>
        </div>

        {/* Clinical Statistics */}
        <div className="lg:col-span-4 card-shell p-8 bg-zinc-900 text-white flex flex-col justify-between relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
              <FiActivity className="w-32 h-32" />
           </div>
           
           <div className="relative z-10">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-8">Medical Stats</h3>
              <div className="space-y-8">
                 <div>
                    <div className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] mb-2">Total Visits</div>
                    <div className="text-6xl font-black italic tracking-tighter">{records.length}</div>
                 </div>
                 <div className="h-px bg-white/10 w-full" />
                 <div>
                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Last Condition</div>
                    <div className="text-xl font-bold uppercase tracking-tight text-zinc-200">
                      {records.filter(r => r.diagnosis).length > 0 
                        ? records.find(r => r.diagnosis)?.diagnosis 
                        : 'N/A'}
                    </div>
                 </div>
              </div>
           </div>
           <div className="mt-12 relative z-10">
              <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.3em] leading-relaxed">
                 Consolidated Clinical<br />Summary Report
              </p>
           </div>
        </div>
      </div>

      {/* History Timeline Snapshot */}
      <div className="card-shell p-8 bg-white dark:bg-dark-card">
         <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2">
           <FiActivity className="text-brand-500 w-4 h-4" /> Clinical History Timeline
         </h3>
         
         <div className="relative border-l-2 border-zinc-100 dark:border-dark-border ml-2 pl-8 space-y-10">
            {records.slice(0, 5).map((record, idx) => (
              <div key={record.id} className="relative">
                 <span className={clsx(
                   "absolute -left-[2.6rem] top-0 w-5 h-5 rounded-full border-4 border-white dark:border-dark-card shadow-lg transition-colors",
                   idx === 0 ? "bg-brand-500" : "bg-zinc-200 dark:bg-zinc-800"
                 )} />
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                       <p className="text-[10px] font-black text-brand-500 uppercase tracking-[0.2em] mb-1">{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                       <h4 className="text-lg font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tight italic">{record.diagnosis || 'Standard Visit'}</h4>
                    </div>
                    <div className="flex items-center gap-3 bg-zinc-50 dark:bg-dark-surface/30 px-4 py-2 rounded-2xl border border-zinc-100 dark:border-dark-border">
                       <FiUser className="w-3.5 h-3.5 text-zinc-400" />
                       <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-widest truncate max-w-[150px]">
                         Dr. {record.vet?.name || 'Vet'}
                       </span>
                    </div>
                 </div>
              </div>
            ))}
            {records.length > 5 && (
              <div className="pt-4">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                   <span className="h-px w-8 bg-zinc-100 dark:bg-dark-border" />
                   + {records.length - 5} more records in full history tab
                </p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
}
