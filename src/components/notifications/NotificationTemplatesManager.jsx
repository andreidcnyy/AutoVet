import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

export default function NotificationTemplatesManager() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState(null);

    const { user } = useAuth();
    const toast = useToast();

    useEffect(() => {
        if (user?.token) {
            fetchTemplates();
        }
    }, [user?.token]);

    const fetchTemplates = async () => {
        try {
            setLoading(true);
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
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this template?')) return;
        try {
            const response = await fetch(`/api/client-notifications/templates/${id}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${user?.token}`
                }
            });
            if (!response.ok) throw new Error('Failed to delete template');
            toast.success('Template deleted');
            fetchTemplates();
        } catch (err) {
            toast.error('Failed to delete template');
        }
    };

    const handleSave = async (templateData) => {
        try {
            const method = currentTemplate ? 'PUT' : 'POST';
            const url = currentTemplate ? `/api/client-notifications/templates/${currentTemplate.id}` : '/api/client-notifications/templates';
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${user?.token}`
                },
                body: JSON.stringify(templateData)
            });
            if (!response.ok) throw new Error('Failed to save template');
            toast.success(currentTemplate ? 'Template updated' : 'Template created');
            setIsModalOpen(false);
            fetchTemplates();
        } catch (err) {
            toast.error('Failed to save template');
        }
    };

    const openModal = (template = null) => {
        setCurrentTemplate(template);
        setIsModalOpen(true);
    };

    if (loading) return <div className="p-4 text-gray-400">Loading templates...</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100">Notification Templates</h1>
                    <p className="text-gray-400">Manage templates for email and SMS notifications.</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    <FiPlus size={18} /> Add Template
                </button>
            </div>

            <div className="bg-[#1e1e2d] rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full text-left border-collapse cursor-default">
                    <thead>
                        <tr className="border-b border-gray-700 bg-[#252538] text-gray-400 text-sm">
                            <th className="p-4 font-semibold w-1/4">Name</th>
                            <th className="p-4 font-semibold w-1/12">Channel</th>
                            <th className="p-4 font-semibold w-1/6">Event Key</th>
                            <th className="p-4 font-semibold w-1/12 text-center">Status</th>
                            <th className="p-4 font-semibold w-1/12 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-300 text-sm">
                        {templates.map(t => (
                            <tr key={t.id} className="border-b border-gray-700/50 hover:bg-[#252538] transition-colors">
                                <td className="p-4">
                                    <div className="font-medium text-gray-200">{t.name}</div>
                                    {t.subject && <div className="text-xs text-gray-500 mt-1">Subj: {t.subject}</div>}
                                </td>
                                <td className="p-4 uppercase">{t.channel}</td>
                                <td className="p-4 text-gray-400">{t.event_key || '-'}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 text-xs rounded-full ${t.is_active ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
                                        {t.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => openModal(t)} className="p-2 text-gray-400 hover:text-blue-400 bg-[#2b2b40] rounded hover:bg-[#32324a] transition-colors"><FiEdit2 size={16} /></button>
                                        <button onClick={() => handleDelete(t.id)} className="p-2 text-gray-400 hover:text-red-400 bg-[#2b2b40] rounded hover:bg-[#32324a] transition-colors"><FiTrash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {templates.length === 0 && (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-gray-500">No templates found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <TemplateFormModal 
                    template={currentTemplate} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave} 
                />
            )}
        </div>
    );
}

function TemplateFormModal({ template, onClose, onSave }) {
    const [formData, setFormData] = useState({
        name: template?.name || '',
        channel: template?.channel || 'email',
        event_key: template?.event_key || '',
        subject: template?.subject || '',
        body: template?.body || '',
        is_active: template !== null ? template?.is_active : true
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-[#1e1e2d] rounded-xl p-6 w-full max-w-lg shadow-2xl border border-gray-700 transform transition-all animate-in fade-in zoom-in duration-200">
                <h2 className="text-xl font-bold mb-6 text-gray-100">{template ? 'Edit Template' : 'Add Template'}</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                            <input 
                                type="text" required
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full bg-[#151521] border border-gray-700 text-gray-200 rounded-lg p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Channel</label>
                            <select 
                                value={formData.channel} 
                                onChange={e => setFormData({...formData, channel: e.target.value})}
                                className="w-full bg-[#151521] border border-gray-700 text-gray-200 rounded-lg p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            >
                                <option value="email">Email</option>
                                <option value="sms">SMS</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Event Key (Optional triggers)</label>
                        <input 
                            type="text" 
                            value={formData.event_key} 
                            onChange={e => setFormData({...formData, event_key: e.target.value})}
                            placeholder="e.g. appointment_confirmed"
                            className="w-full bg-[#151521] border border-gray-700 text-gray-200 rounded-lg p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                    </div>

                    {formData.channel === 'email' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Subject</label>
                            <input 
                                type="text" required
                                value={formData.subject} 
                                onChange={e => setFormData({...formData, subject: e.target.value})}
                                className="w-full bg-[#151521] border border-gray-700 text-gray-200 rounded-lg p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Body</label>
                        <div className="text-xs text-gray-500 mb-2">Available variables: {'{owner_name}, {clinic_name}'}</div>
                        <textarea 
                            required rows="4"
                            value={formData.body} 
                            onChange={e => setFormData({...formData, body: e.target.value})}
                            className="w-full bg-[#151521] border border-gray-700 text-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="is_active"
                            checked={formData.is_active} 
                            onChange={e => setFormData({...formData, is_active: e.target.checked})}
                            className="rounded border-gray-700 bg-[#151521] text-blue-500 focus:ring-blue-500 focus:ring-offset-[#1e1e2d] w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="is_active" className="text-sm text-gray-400 cursor-pointer">Template is active</label>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-700">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-[#2b2b40] hover:bg-[#32324a] text-gray-300 rounded-lg transition-colors font-medium">Cancel</button>
                        <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">Save</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
