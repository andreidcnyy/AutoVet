import React, { useState, useEffect } from 'react';
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl text-gray-800">
                <h2 className="text-xl font-bold mb-4">Send Notification to {owner.name}</h2>
                
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Channel</label>
                        <select 
                            value={channel} 
                            onChange={(e) => setChannel(e.target.value)}
                            className="w-full border rounded p-2 text-gray-800 bg-white"
                        >
                            <option value="email">Email</option>
                            <option value="sms">SMS</option>
                        </select>
                        {channel === 'email' && !owner.email && (
                            <p className="text-red-500 text-sm mt-1">Owner has no email address for email notifications</p>
                        )}
                        {channel === 'sms' && !owner.phone && (
                            <p className="text-red-500 text-sm mt-1">Owner has no phone number for SMS notifications</p>
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Template (Optional)</label>
                        <select 
                            value={selectedTemplate} 
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            className="w-full border rounded p-2 text-gray-800 bg-white"
                        >
                            <option value="">-- Custom Message --</option>
                            {filteredTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    {!selectedTemplate && (
                        <>
                            {channel === 'email' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium mb-1">Subject</label>
                                    <input 
                                        type="text" 
                                        value={title} 
                                        onChange={(e) => setTitle(e.target.value)} 
                                        className="w-full border rounded p-2 text-gray-800 bg-white"
                                        required
                                    />
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Message</label>
                                <textarea 
                                    value={customMessage} 
                                    onChange={(e) => setCustomMessage(e.target.value)} 
                                    className="w-full border rounded p-2 h-24 text-gray-800 bg-white"
                                    required
                                />
                            </div>
                        </>
                    )}

                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={loading || (channel === 'email' && !owner.email) || (channel === 'sms' && !owner.phone)} 
                            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                        >
                            {loading ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
