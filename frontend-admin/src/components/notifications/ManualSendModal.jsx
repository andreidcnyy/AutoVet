import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export default function ManualSendModal({ isOpen, onClose, owner, relatedObject, relatedType }) {
    const [templates, setTemplates] = useState([]);
    const [channel, setChannel] = useState('email');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);

    const { user } = useAuth();
    const toast = useToast();

    useEffect(() => {
        if (isOpen && user?.token) {
            fetchTemplates();
        }
    }, [isOpen, user?.token]);

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/client-notifications/templates', {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${user?.token}`
                }
            });
            if (!response.ok) throw new Error('Failed to load templates');
            const data = await response.json();
            setTemplates(data);
        } catch (err) {
            toast.error('Failed to load templates');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Strict front-end validation
        if (channel === 'email' && !owner.email) {
            toast.error('Owner has no email address for email notifications');
            return;
        }

        if (channel === 'sms' && !owner.phone) {
            toast.error('Owner has no phone number for SMS notifications');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/client-notifications/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${user?.token}`
                },
                body: JSON.stringify({
                    owner_id: owner.id,
                    channel,
                    template_id: selectedTemplate || null,
                    custom_message: customMessage || null,
                    title: channel === 'email' ? title : null,
                    related_type: relatedType || null,
                    related_id: relatedObject ? relatedObject.id : null,
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to send notification');
            }
            
            toast.success('Notification sent successfully!');
            onClose();
        } catch (err) {
            toast.error(err.message || 'Failed to send notification');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !owner) return null;

    const filteredTemplates = templates.filter(t => t.channel === channel && t.is_active);

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop with blur */}
            <div 
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />
            
            {/* Modal Container */}
            <div className="relative bg-white dark:bg-dark-card rounded-2xl p-8 w-full max-w-md shadow-2xl border dark:border-dark-border transform transition-all animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50 italic">
                        <span className="text-blue-600 dark:text-blue-400 mr-2">/</span>Notify Owner
                    </h2>
                    <button 
                        onClick={onClose}
                        className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 dark:bg-dark-surface dark:text-zinc-400 dark:hover:bg-dark-border transition-all"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 px-1">Sending to: <span className="text-slate-700 dark:text-zinc-300">{owner.name}</span></p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 text-left">Transmission Channel</label>
                        <div className="relative">
                            <select 
                                value={channel} 
                                onChange={(e) => setChannel(e.target.value)}
                                className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
                            >
                                <option value="email">Email System</option>
                                <option value="sms">SMS Gateway</option>
                            </select>
                            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                        {channel === 'email' && !owner.email && (
                            <p className="text-rose-500 text-[10px] font-bold italic mt-2 px-1">Error: Missing email address record</p>
                        )}
                        {channel === 'sms' && !owner.phone && (
                            <p className="text-rose-500 text-[10px] font-bold italic mt-2 px-1">Error: Missing phone number record</p>
                        )}
                    </div>

                    <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 text-left">Select Template</label>
                        <div className="relative">
                            <select 
                                value={selectedTemplate} 
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
                            >
                                <option value="">-- Custom Manual Entry --</option>
                                {filteredTemplates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {!selectedTemplate && (
                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                            {channel === 'email' && (
                                <div>
                                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 text-left">Subject Line</label>
                                    <input 
                                        type="text" 
                                        value={title} 
                                        onChange={(e) => setTitle(e.target.value)} 
                                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
                                        placeholder="Communication Subject"
                                        required
                                    />
                                </div>
                            )}
                            <div>
                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 text-left">Message Content</label>
                                <textarea 
                                    value={customMessage} 
                                    onChange={(e) => setCustomMessage(e.target.value)} 
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 min-h-[120px]"
                                    placeholder="Enter your message here..."
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 mt-8">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 h-12 rounded-xl border-2 border-slate-100 text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all dark:border-dark-border dark:hover:bg-dark-surface"
                        >
                            Abort
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading || (channel === 'email' && !owner.email) || (channel === 'sms' && !owner.phone)} 
                            className="flex-[2] h-12 rounded-xl bg-blue-600 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
                        >
                            {loading ? 'Processing...' : 'Dispatch Message'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
