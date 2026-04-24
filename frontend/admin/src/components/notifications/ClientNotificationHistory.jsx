import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

export default function ClientNotificationHistory() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // Filters
    const [channel, setChannel] = useState('');
    const [status, setStatus] = useState('');

    const { user } = useAuth();

    useEffect(() => {
        if (user?.token) {
            fetchHistory();
        }
    }, [page, channel, status, user?.token]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const params = { page };
            if (channel) params.channel = channel;
            if (status) params.status = status;
            
            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`/api/client-notifications?${queryString}`, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${user?.token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch history');
            const data = await response.json();
            setHistory(data.data);
            setTotalPages(data.last_page);
        } catch (err) {
            console.error('Failed to load notification history', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100">Notification Log</h1>
                    <p className="text-gray-400">History of outbound client communications.</p>
                </div>
                <div className="flex gap-3">
                    <select 
                        value={channel} 
                        onChange={e => { setChannel(e.target.value); setPage(1); }}
                        className="bg-[#1e1e2d] border border-gray-700 text-gray-300 rounded-lg p-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                        <option value="">All Channels</option>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                    </select>
                    <select 
                        value={status} 
                        onChange={e => { setStatus(e.target.value); setPage(1); }}
                        className="bg-[#1e1e2d] border border-gray-700 text-gray-300 rounded-lg p-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                    </select>
                    <button onClick={fetchHistory} className="p-2 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-[#2b2b40] transition-colors">
                        <FiRefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="bg-[#1e1e2d] rounded-xl border border-gray-700 overflow-hidden mb-4">
                <table className="w-full text-left border-collapse cursor-default">
                    <thead>
                        <tr className="border-b border-gray-700 bg-[#252538] text-gray-400 text-sm">
                            <th className="p-4 font-semibold w-1/6">Date</th>
                            <th className="p-4 font-semibold w-1/6">Recipient</th>
                            <th className="p-4 font-semibold w-2/5">Message Preview</th>
                            <th className="p-4 font-semibold w-1/12 text-center">Type</th>
                            <th className="p-4 font-semibold w-1/12 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-300 text-sm">
                        {loading && history.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading...</td></tr>
                        ) : history.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-500">No records found.</td></tr>
                        ) : (
                            history.map(item => (
                                <tr key={item.id} className="border-b border-gray-700/50 hover:bg-[#252538] transition-colors relative group">
                                    <td className="p-4 align-top whitespace-nowrap text-gray-400">
                                        {format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="font-medium text-gray-200">{item.owner?.name || 'Unknown'}</div>
                                        <div className="text-xs text-gray-500 flex gap-2 mt-1 uppercase items-center">
                                            {item.channel}
                                        </div>
                                    </td>
                                    <td className="p-4 align-top">
                                        {item.title && <div className="font-medium text-gray-200 mb-1">{item.title}</div>}
                                        <div className="text-gray-400 line-clamp-2 pr-4">{item.message}</div>
                                        {item.status === 'failed' && item.error_message && (
                                            <div className="text-red-400 text-xs mt-2 bg-red-400/10 p-2 rounded inline-block">
                                                Error: {item.error_message}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 align-top text-center text-gray-400 capitalize">
                                        {item.type}
                                    </td>
                                    <td className="p-4 align-top text-center">
                                        <span className={`px-2 py-1 text-xs rounded-full border ${
                                            item.status === 'sent' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                                            item.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                                            'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center text-gray-400 text-sm">
                    <div>Page {page} of {totalPages}</div>
                    <div className="flex gap-2">
                        <button 
                            disabled={page === 1} 
                            onClick={() => setPage(p => p - 1)}
                            className="px-3 py-1.5 bg-[#1e1e2d] border border-gray-700 rounded hover:bg-[#2b2b40] disabled:opacity-50 transition-colors"
                        >
                            Previous
                        </button>
                        <button 
                            disabled={page === totalPages} 
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1.5 bg-[#1e1e2d] border border-gray-700 rounded hover:bg-[#2b2b40] disabled:opacity-50 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
