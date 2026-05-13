import { useState, useEffect } from 'react';
import axios from 'axios';
import { exportExpensesCSV } from '../utils/csvExport';
import { API } from '../utils/api';
const CATEGORIES = ['Rent', 'Electricity', 'Salary', 'Transport', 'Purchase', 'Maintenance', 'Marketing', 'Other'];
const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card'];
const CAT_ICONS = { Rent: '🏠', Electricity: '💡', Salary: '👷', Transport: '🚗', Purchase: '📦', Maintenance: '🔧', Marketing: '📣', Other: '💸' };
const CAT_COLORS = { Rent: 'from-blue-500 to-blue-400', Electricity: 'from-yellow-500 to-amber-400', Salary: 'from-purple-500 to-purple-400', Transport: 'from-cyan-500 to-cyan-400', Purchase: 'from-orange-500 to-orange-400', Maintenance: 'from-red-500 to-rose-400', Marketing: 'from-pink-500 to-pink-400', Other: 'from-gray-500 to-gray-400' };

const EMPTY_FORM = { title: '', amount: '', category: 'Other', paymentMethod: 'Cash', note: '', date: new Date().toISOString().split('T')[0] };

const F = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</label>
    {children}
  </div>
);

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const getConfig = () => {
    const u = JSON.parse(localStorage.getItem('userInfo'));
    return { headers: { Authorization: `Bearer ${u.token}` } };
  };

  useEffect(() => { fetchExpenses(); }, [filterCat, fromDate, toDate]);

  async function fetchExpenses() {
    try {
      const params = new URLSearchParams();
      if (filterCat) params.append('category', filterCat);
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      const { data } = await axios.get(`${API}/expenses?${params}`, getConfig());
      setExpenses(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setEditExpense(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };
  const openEdit = (exp) => { setEditExpense(exp); setForm({ title: exp.title, amount: exp.amount, category: exp.category, paymentMethod: exp.paymentMethod, note: exp.note || '', date: new Date(exp.date).toISOString().split('T')[0] }); setError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title || !form.amount) return setError('Title and amount are required');
    setSaving(true); setError('');
    try {
      if (editExpense) {
        const { data } = await axios.put(`${API}/expenses/${editExpense._id}`, form, getConfig());
        setExpenses(prev => prev.map(ex => ex._id === data._id ? data : ex));
      } else {
        const { data } = await axios.post(`${API}/expenses`, form, getConfig());
        setExpenses(prev => [data, ...prev]);
      }
      setShowModal(false);
    } catch (e) { setError(e.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    await axios.delete(`${API}/expenses/${id}`, getConfig());
    setExpenses(prev => prev.filter(e => e._id !== id));
  };

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = CATEGORIES.map(cat => ({
    cat, total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const inputClass = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Expense Tracker</h1>
          <p className="text-gray-500 font-medium">Track all your shop operational expenses</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => exportExpensesCSV(expenses)} className="px-5 py-3 rounded-2xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition text-sm">
            📥 Export CSV
          </button>
          <button onClick={openAdd} className="bg-orange-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-orange-700 shadow-lg shadow-orange-500/20 transition active:scale-95">
            + Add Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="col-span-2 bg-gradient-to-br from-orange-500 to-red-500 text-white p-6 rounded-3xl shadow-lg shadow-orange-500/30">
          <p className="text-xs font-black uppercase tracking-widest text-white/70 mb-1">Total Expenses</p>
          <h2 className="text-4xl font-black">₹{totalExpenses.toLocaleString()}</h2>
          <p className="text-white/70 text-sm font-medium mt-1">{expenses.length} transactions</p>
        </div>
        {byCategory.slice(0, 2).map(({ cat, total }) => (
          <div key={cat} className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-md">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${CAT_COLORS[cat]} text-white flex items-center justify-center text-lg mb-3`}>{CAT_ICONS[cat]}</div>
            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">{cat}</p>
            <h3 className="text-2xl font-black text-gray-900">₹{total.toLocaleString()}</h3>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      {byCategory.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-black text-gray-800 mb-4">Spending by Category</h3>
          <div className="space-y-3">
            {byCategory.map(({ cat, total }) => (
              <div key={cat} className="flex items-center gap-4">
                <span className="text-xl w-7">{CAT_ICONS[cat]}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm font-bold text-gray-700 mb-1">
                    <span>{cat}</span><span>₹{total.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`bg-gradient-to-r ${CAT_COLORS[cat]} h-2 rounded-full transition-all`}
                      style={{ width: `${Math.min(100, (total / totalExpenses) * 100)}%` }} />
                  </div>
                </div>
                <span className="text-xs font-black text-gray-400 w-10 text-right">{((total / totalExpenses) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-500" />
        {(filterCat || fromDate || toDate) && (
          <button onClick={() => { setFilterCat(''); setFromDate(''); setToDate(''); }} className="px-4 py-2 border border-red-200 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition">✕ Clear</button>
        )}
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
            <tr>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Method</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan="6" className="text-center py-16 text-gray-400 font-bold">Loading...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-2">💸</div>
                <div className="font-bold">No expenses recorded</div>
              </td></tr>
            ) : expenses.map(exp => (
              <tr key={exp._id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-black text-gray-900">{exp.title}</div>
                  {exp.note && <div className="text-xs text-gray-400 font-medium">{exp.note}</div>}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r ${CAT_COLORS[exp.category]} text-white`}>
                    {CAT_ICONS[exp.category]} {exp.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600 font-medium">{exp.paymentMethod}</td>
                <td className="px-6 py-4 text-gray-500 font-medium">{new Date(exp.date).toLocaleDateString('en-IN')}</td>
                <td className="px-6 py-4 text-right font-black text-gray-900 text-base">₹{exp.amount.toLocaleString()}</td>
                <td className="px-6 py-4 sticky right-0 bg-white lg:bg-transparent shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.05)] lg:shadow-none">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(exp)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition">✏️</button>
                    <button onClick={() => handleDelete(exp._id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-900">{editExpense ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 font-black text-2xl">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <F label="Title">
                <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="e.g. Monthly Rent" className={inputClass} />
              </F>
              <div className="grid grid-cols-2 gap-4">
                <F label="Amount (₹)">
                  <input type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} placeholder="0" className={inputClass} />
                </F>
                <F label="Date">
                  <input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} className={inputClass} />
                </F>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <F label="Category">
                  <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} className={inputClass}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </F>
                <F label="Payment Method">
                  <select value={form.paymentMethod} onChange={e => setForm(p => ({...p, paymentMethod: e.target.value}))} className={inputClass}>
                    {METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </F>
              </div>
              <F label="Note (optional)">
                <input value={form.note} onChange={e => setForm(p => ({...p, note: e.target.value}))} placeholder="Any additional details..." className={inputClass} />
              </F>
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-bold text-sm">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-2xl bg-orange-600 text-white font-black hover:bg-orange-700 transition disabled:opacity-50">
                  {saving ? 'Saving...' : editExpense ? 'Update' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
