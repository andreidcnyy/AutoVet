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
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

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

            // Auto-select logic
            if (relatedType === 'App\\Models\\Appointment') {
                const reminderTemplate = data.find(t => t.event_key === 'appointment_reminder' && t.channel === channel);
                if (reminderTemplate) {
                    setSelectedTemplate(reminderTemplate.id);
                } else {
                    // Pre-fill for appointments if no template found
                    setTitle('Appointment Reminder - Pet Wellness');
                    setCustomMessage('Hello This is from Pet Wellness Animal Clinic and We would like to reminde you on our scheduled booking {date_scheduled}, {arrival_time}, {patient}.');
                }
            } else if (relatedType === 'App\\Models\\MedicalRecord') {
                const medicalTemplate = data.find(t => t.event_key === 'medical_record_update' && t.channel === channel);
                if (medicalTemplate) {
                    setSelectedTemplate(medicalTemplate.id);
                } else {
                    setTitle('Medical Record Update - Pet Wellness');
                    setCustomMessage('Hello {owner_name}, a new medical record has been added for your pet {patient}. Findings: {findings}');
                }
            }
        } catch (err) {
            toast.error('Failed to load templates');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (channel === 'email' && !owner.email) {
            toast.error('Owner has no email address');
            return;
        }

        setLoading(true);

        try {
            // 1. If "Save as Template" is checked, create the template first
            if (saveAsTemplate && !selectedTemplate && newTemplateName) {
                const tResponse = await fetch('/api/client-notifications/templates', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${user?.token}`
                    },
                    body: JSON.stringify({
                        name: newTemplateName,
                        channel,
                        subject: channel === 'email' ? title : null,
                        body: customMessage,
                        event_key: relatedType === 'App\\Models\\Appointment' ? 'appointment_reminder' : null,
                        is_active: true
                    })
                });
                if (!tResponse.ok) throw new Error('Failed to save as template');
                toast.info('Template saved successfully');
            }

            // 2. Send the notification
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
                className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />
            
            {/* Modal Container */}
            <div className="relative bg-white dark:bg-dark-card rounded-2xl p-8 w-full max-w-md shadow-2xl border dark:border-dark-border transform transition-all animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 italic">
                        <span className="text-emerald-600 dark:text-emerald-400 mr-2">/</span>Notify Owner
                    </h2>
                    <button 
                        onClick={onClose}
                        className="rounded-xl bg-zinc-100 p-2 text-zinc-500 hover:bg-zinc-200 dark:bg-dark-surface dark:text-zinc-400 dark:hover:bg-dark-border transition-all"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6 px-1">Sending to: <span className="text-zinc-700 dark:text-zinc-300">{owner.name}</span></p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1 text-left">Transmission Channel</label>
                        <div className="relative">
                            <select 
                                value={channel} 
                                onChange={(e) => setChannel(e.target.value)}
                                className="h-12 w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
                            >
                                <option value="email">Email System</option>
                                <option value="sms">SMS Gateway</option>
                            </select>
                            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1 text-left">Select Template</label>
                        <div className="relative">
                            <select 
                                value={selectedTemplate} 
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                className="h-12 w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
                            >
                                <option value="">-- Custom Manual Entry --</option>
                                {filteredTemplates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
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
                                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1 text-left">Subject Line</label>
                                    <input 
                                        type="text" 
                                        value={title} 
                                        onChange={(e) => setTitle(e.target.value)} 
                                        className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 placeholder:text-zinc-400 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200"
                                        placeholder="Communication Subject"
                                        required
                                    />
                                </div>
                            )}
                            <div>
                                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1 text-left">Message Content</label>
                                <div className="mb-2 text-[9px] text-zinc-500 font-bold uppercase italic tracking-tighter">
                                    Available: {'{owner_name}, {date_scheduled}, {arrival_time}, {patient}'}
                                </div>
                                <textarea 
                                    value={customMessage} 
                                    onChange={(e) => setCustomMessage(e.target.value)} 
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-700 placeholder:text-zinc-400 focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-zinc-200 min-h-[120px]"
                                    placeholder="Enter your message here..."
                                    required
                                />
                            </div>

                            {/* Save as Template Option */}
                            <div className="p-4 bg-zinc-50 dark:bg-dark-surface rounded-xl border border-zinc-100 dark:border-dark-border">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={saveAsTemplate}
                                        onChange={(e) => setSaveAsTemplate(e.target.checked)}
                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400 tracking-wider">Save as reusable template?</span>
                                </label>
                                {saveAsTemplate && (
                                    <input 
                                        type="text"
                                        placeholder="Enter Template Name..."
                                        value={newTemplateName}
                                        onChange={(e) => setNewTemplateName(e.target.value)}
                                        className="mt-3 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-zinc-200 shadow-inner"
                                        required
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 mt-8">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 h-12 rounded-xl border-2 border-zinc-100 text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-all dark:border-dark-border dark:hover:bg-dark-surface"
                        >
                            Abort
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="flex-[2] h-12 rounded-xl bg-emerald-600 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95"
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
