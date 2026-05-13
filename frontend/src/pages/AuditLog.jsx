import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../utils/api';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo'));
      const { data } = await axios.get(`${API}/audit`, {
        headers: { Authorization: `Bearer ${userInfo.token}` }
      });
      setLogs(data);
    } catch (error) {
      console.error('Failed to load logs', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.details?.toLowerCase().includes(search.toLowerCase()) || 
                         log.user?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesAction = !actionFilter || log.action === actionFilter;
    const matchesUser = !userFilter || log.user?._id === userFilter;
    
    // Date Filtering
    const logDate = new Date(log.createdAt);
    const matchesStart = !startDate || logDate >= new Date(startDate);
    const matchesEnd = !endDate || logDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999));
    
    return matchesSearch && matchesAction && matchesUser && matchesStart && matchesEnd;
  });

  // Calculate stats from filtered logs
  const stats = filteredLogs.reduce((acc, log) => {
    if (log.action === 'Created Invoice') {
      // Parse amount from "Generated invoice ... for ₹1200"
      const match = log.details?.match(/₹([\d,.]+)/);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        acc.totalSales += amount;
        acc.salesCount += 1;
      }
    }
    return acc;
  }, { totalSales: 0, salesCount: 0 });

  const uniqueActions = [...new Set(logs.map(l => l.action))];
  const uniqueUsers = Array.from(new Map(logs.map(l => [l.user?._id, l.user])).values()).filter(u => u);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Audit Log</h1>
          <p className="text-gray-500 font-medium">Track all user activities and system changes</p>
        </div>
        <button onClick={fetchLogs} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 transition">
          🔄 Refresh
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl">💰</div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Filtered Sales</p>
            <h3 className="text-2xl font-black text-gray-900">₹{stats.totalSales.toLocaleString('en-IN')}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl">🧾</div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Invoices Count</p>
            <h3 className="text-2xl font-black text-gray-900">{stats.salesCount}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center text-2xl">🔄</div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Avg. Ticket Size</p>
            <h3 className="text-2xl font-black text-gray-900">₹{(stats.salesCount ? (stats.totalSales / stats.salesCount) : 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input 
            type="text" 
            placeholder="🔍 Search details or user..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-5 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <select 
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-5 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="">All Actions</option>
            {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select 
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-5 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="">All Users</option>
            {uniqueUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 bg-white p-3 border border-gray-200 rounded-2xl shadow-sm">
            <span className="text-xs font-black text-gray-400 uppercase ml-2">From:</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 bg-transparent outline-none font-bold text-gray-900"
            />
          </div>
          <div className="flex items-center gap-3 bg-white p-3 border border-gray-200 rounded-2xl shadow-sm">
            <span className="text-xs font-black text-gray-400 uppercase ml-2">To:</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 bg-transparent outline-none font-bold text-gray-900"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 text-center text-gray-400 font-bold">Loading logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-20 text-center text-gray-400 font-bold">
            <div className="text-4xl mb-2">🕵️‍♂️</div>
            No activity logs match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
              <tr>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLogs.map((log) => (
                <tr key={log._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-xs font-bold text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-black text-gray-900">{log.user?.name || 'Unknown'}</span>
                    {log.user?.role === 'Admin' && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black">ADMIN</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-black border border-blue-100 whitespace-nowrap">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-medium text-xs">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
