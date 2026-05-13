import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../utils/api';

const Modal = ({ title, onClose, children, size = 'max-w-xl' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className={`bg-white rounded-3xl shadow-2xl w-full ${size} max-h-[90vh] overflow-y-auto`}>
      <div className="flex justify-between items-center px-8 py-6 border-b">
        <h2 className="text-xl font-black text-gray-900">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl leading-none font-black transition">×</button>
      </div>
      <div className="p-8">{children}</div>
    </div>
  </div>
);

const Staff = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const getConfig = () => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    return { headers: { Authorization: `Bearer ${userInfo.token}` } };
  };

  useEffect(() => { fetchStaff(); }, []);

  async function fetchStaff() {
    try {
      const { data } = await axios.get(`${API}/auth/staff`, getConfig());
      setStaff(data);
    } catch (e) {
      console.error('Error fetching staff', e);
    } finally {
      setLoading(false);
    }
  }

  const openAdd = () => { setEditUser(null); setForm({ name: '', email: '', password: '' }); setError(''); setShowModal(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ name: u.name, email: u.email, password: '' }); setError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return setError('Name and Email are required');
    if (!editUser && !form.password) return setError('Password is required for new staff');
    
    setSaving(true); setError('');
    try {
      if (editUser) {
        const payload = { name: form.name, email: form.email };
        if (form.password) payload.password = form.password;
        const { data } = await axios.put(`${API}/auth/staff/${editUser._id}`, payload, getConfig());
        setStaff(prev => prev.map(u => u._id === data._id ? { ...u, ...data } : u));
      } else {
        const { data } = await axios.post(`${API}/auth/staff`, form, getConfig());
        setStaff([data, ...staff]);
      }
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff account?')) return;
    try {
      await axios.delete(`${API}/auth/staff/${id}`, getConfig());
      setStaff(prev => prev.filter(u => u._id !== id));
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to delete');
    }
  };

  const inputClass = "w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all";

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Staff Management</h1>
          <p className="text-gray-500 font-medium">Create and manage cashier accounts</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 shadow-lg transition active:scale-95">
          + Add Staff
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
            <tr>
              <th className="px-8 py-5">Staff Name</th>
              <th className="px-8 py-5">Email (Login ID)</th>
              <th className="px-8 py-5">Role</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan="4" className="text-center py-16 text-gray-400 font-bold">Loading...</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan="4" className="text-center py-16 text-gray-400 font-bold">No staff accounts found</td></tr>
            ) : (
              staff.map(u => (
                <tr key={u._id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-5 font-black text-gray-900">{u.name}</td>
                  <td className="px-8 py-5 font-bold text-gray-700">{u.email}</td>
                  <td className="px-8 py-5">
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold border border-blue-100">
                      {u.role || 'Staff'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(u)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition">✏️</button>
                      <button onClick={() => handleDelete(u._id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editUser ? 'Edit Staff Account' : 'New Staff Account'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-5">
            {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100">{error}</div>}
            
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Staff Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="e.g. Rahul Cashier" required />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Email (Login ID) *</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="rahul@shop.com" required />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                {editUser ? 'New Password (leave blank to keep current)' : 'Password *'}
              </label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputClass} placeholder="Enter password" required={!editUser} />
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-gray-500 font-bold border border-gray-200 hover:bg-gray-50 rounded-2xl transition">Cancel</button>
              <button type="submit" disabled={saving} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">
                {saving ? 'Saving...' : editUser ? 'Update Account' : 'Create Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Staff;
