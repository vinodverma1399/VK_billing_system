import { useState, useEffect } from 'react';
import axios from 'axios';
import { exportVendorsCSV } from '../utils/csvExport';
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

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [form, setForm] = useState({ name: '', mobile: '', gst: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statement, setStatement] = useState(null);
  const [statementData, setStatementData] = useState({ purchases: [], loading: false });
  const [search, setSearch] = useState('');

  // Payment state — which purchase is being paid right now
  const [payingFor, setPayingFor] = useState(null); // purchase._id
  const [payForm, setPayForm] = useState({ amount: '', method: 'Cash', note: '' });
  const [paySubmitting, setPaySubmitting] = useState(false);

  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const userRole = userInfo.role || 'Admin';

  const getConfig = () => ({ headers: { Authorization: `Bearer ${userInfo.token}` } });

  useEffect(() => { fetchVendors(); }, []);

  async function fetchVendors() {
    try {
      const [vendorRes, purchaseRes] = await Promise.all([
        axios.get(`${API}/vendors`, getConfig()),
        axios.get(`${API}/purchases`, getConfig())
      ]);
      setVendors(vendorRes.data);
      setPurchases(purchaseRes.data);
    } catch (err) {
      console.error('Error fetching vendors', err);
    } finally {
      setLoading(false);
    }
  }

  const getVendorBalance = (vendorId) => {
    const vendorPurchases = purchases.filter(p => p.vendor?._id === vendorId || p.vendor === vendorId);
    return vendorPurchases.filter(p => p.status !== 'Paid').reduce((s, p) => s + (p.totalCost - (p.amountPaid || 0)), 0);
  };

  const openAdd = () => { setEditVendor(null); setForm({ name: '', mobile: '', gst: '' }); setError(''); setShowModal(true); };
  const openEdit = (v) => { setEditVendor(v); setForm({ name: v.name, mobile: v.mobile, gst: v.gst || '' }); setError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.mobile) return setError('Name and Mobile are required');
    setSaving(true); setError('');
    try {
      if (editVendor) {
        const { data } = await axios.put(`${API}/vendors/${editVendor._id}`, form, getConfig());
        setVendors(prev => prev.map(v => v._id === data._id ? data : v));
      } else {
        const { data } = await axios.post(`${API}/vendors`, form, getConfig());
        setVendors([data, ...vendors]);
      }
      setShowModal(false);
    } catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this vendor? Note: Existing purchases will lose the vendor reference.')) return;
    try {
      await axios.delete(`${API}/vendors/${id}`, getConfig());
      setVendors(prev => prev.filter(v => v._id !== id));
    } catch (e) { alert(e.response?.data?.message || 'Failed to delete'); }
  };

  const openStatement = async (vendor) => {
    setStatement(vendor);
    setPayingFor(null);
    setPayForm({ amount: '', method: 'Cash', note: '' });
    setStatementData({ purchases: [], loading: true });
    try {
      const { data } = await axios.get(`${API}/purchases`, getConfig());
      const vendorPurchases = data.filter(p => p.vendor?._id === vendor._id || p.vendor === vendor._id);
      setStatementData({ purchases: vendorPurchases, loading: false });
    } catch (e) { setStatementData({ purchases: [], loading: false }); }
  };

  // Record payment for a specific purchase
  const handlePaySubmit = async (e, purchaseId) => {
    e.preventDefault();
    if (!payForm.amount || Number(payForm.amount) <= 0) return;
    setPaySubmitting(true);
    try {
      await axios.put(`${API}/purchases/${purchaseId}/pay`, {
        amount: Number(payForm.amount),
        method: payForm.method,
        note: payForm.note
      }, getConfig());

      // Refresh statement + vendor list
      setPayingFor(null);
      setPayForm({ amount: '', method: 'Cash', note: '' });
      await fetchVendors();
      // Re-open statement with fresh data
      if (statement) {
        const { data } = await axios.get(`${API}/purchases`, getConfig());
        const vendorPurchases = data.filter(p => p.vendor?._id === statement._id || p.vendor === statement._id);
        setStatementData({ purchases: vendorPurchases, loading: false });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Payment failed');
    } finally {
      setPaySubmitting(false);
    }
  };

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.mobile.includes(search)
  );

  const inputClass = "w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all";

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Suppliers / Vendors</h1>
          <p className="text-gray-500 font-medium">{vendors.length} registered vendors</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => exportVendorsCSV(vendors)} className="px-5 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition text-sm">
            ⬇️ Export CSV
          </button>
          {userRole === 'Admin' && (
            <button onClick={openAdd} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 shadow-lg transition active:scale-95">
              + Add Vendor
            </button>
          )}
        </div>
      </div>

      <input
        type="text" placeholder="🔍 Search by name or mobile..."
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
      />

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
            <tr>
              <th className="px-8 py-5">Vendor Name</th>
              <th className="px-8 py-5">Mobile</th>
              <th className="px-8 py-5">GST Identification</th>
              <th className="px-8 py-5">Pending Payable</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan="5" className="text-center py-16 text-gray-400 font-bold">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-2">🏢</div>
                <div className="font-bold">No vendors found</div>
              </td></tr>
            ) : (
              filtered.map((v) => {
                const bal = getVendorBalance(v._id);
                return (
                  <tr key={v._id} className={`hover:bg-gray-50/50 transition-colors group ${bal > 0 ? 'bg-amber-50/40 border-l-4 border-l-amber-500' : ''}`}>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-black text-base flex items-center justify-center flex-shrink-0">
                          {v.name[0].toUpperCase()}
                        </div>
                        <span className="font-black text-gray-900">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 font-bold text-gray-700">{v.mobile}</td>
                    <td className="px-8 py-5">
                      <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-mono text-xs font-bold border border-blue-100">
                        {v.gst || 'UNREGISTERED'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      {bal > 0 ? (
                        <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-700 font-black text-xs border border-amber-200">
                          ₹{bal.toLocaleString()} Pending
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 font-black text-xs border border-emerald-100">
                          Cleared
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openStatement(v)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black hover:bg-emerald-100 transition">📒 Ledger</button>
                        {userRole === 'Admin' && <>
                          <button onClick={() => openEdit(v)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition">✏️</button>
                          <button onClick={() => handleDelete(v._id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition">🗑️</button>
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add/Edit Vendor Modal */}
      {showModal && (
        <Modal title={editVendor ? 'Edit Vendor' : 'New Vendor'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-5">
            {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100">{error}</div>}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Vendor / Company Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Enter vendor name..." required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Contact Number *</label>
              <input type="text" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} className={inputClass} placeholder="10-digit mobile" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">GSTIN (Optional)</label>
              <input type="text" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} className={`${inputClass} font-mono`} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-gray-500 font-bold border border-gray-200 hover:bg-gray-50 rounded-2xl transition">Cancel</button>
              <button type="submit" disabled={saving} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">
                {saving ? 'Saving...' : editVendor ? 'Update Vendor' : 'Register Vendor'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Vendor Ledger Modal */}
      {statement && (
        <Modal title={`📒 ${statement.name} — Payment Ledger`} onClose={() => { setStatement(null); setPayingFor(null); }} size="max-w-4xl">
          {statementData.loading ? (
            <div className="text-center py-10 text-gray-400 font-bold">Loading ledger...</div>
          ) : (
            <div className="space-y-5">
              {/* Vendor Summary Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black uppercase text-gray-400">Mobile</p>
                  <p className="font-black text-gray-900">{statement.mobile}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black uppercase text-gray-400">Total Purchases</p>
                  <p className="font-black text-gray-900">{statementData.purchases.length}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black uppercase text-gray-400">Total Value</p>
                  <p className="font-black text-gray-900">₹{statementData.purchases.reduce((s, p) => s + p.totalCost, 0).toLocaleString()}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                  <p className="text-[10px] font-black uppercase text-amber-600">Pending Payable</p>
                  <p className="font-black text-amber-700">₹{statementData.purchases.filter(p => p.status !== 'Paid').reduce((s, p) => s + (p.totalCost - (p.amountPaid || 0)), 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Purchases Table */}
              {statementData.purchases.length === 0 ? (
                <div className="text-center py-8 text-gray-400 font-bold">No purchases from this vendor</div>
              ) : (
                <div className="space-y-3">
                  {statementData.purchases.map(p => {
                    const balance = p.totalCost - (p.amountPaid || 0);
                    const isPaying = payingFor === p._id;
                    return (
                      <div key={p._id} className={`rounded-2xl border ${balance > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-gray-50/30'}`}>
                        {/* Purchase Row */}
                        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-gray-900 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">PO-{p._id.substring(18).toUpperCase()}</span>
                              <span className="text-xs text-gray-400">{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${p.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{p.status}</span>
                            </div>
                            <div className="flex gap-4 mt-1 text-xs">
                              <span className="text-gray-500">Bill: <b className="text-gray-900">₹{p.totalCost.toLocaleString()}</b></span>
                              <span className="text-emerald-600">Paid: <b>₹{(p.amountPaid || 0).toLocaleString()}</b></span>
                              {balance > 0 && <span className="text-amber-600">Due: <b>₹{balance.toLocaleString()}</b></span>}
                            </div>
                          </div>
                          {userRole === 'Admin' && balance > 0 && (
                            <button
                              onClick={() => { setPayingFor(isPaying ? null : p._id); setPayForm({ amount: '', method: 'Cash', note: '' }); }}
                              className={`text-xs font-black px-4 py-2 rounded-xl transition ${isPaying ? 'bg-gray-200 text-gray-600' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'}`}
                            >
                              {isPaying ? '✕ Cancel' : '💳 Pay Now'}
                            </button>
                          )}
                        </div>

                        {/* Inline Pay Form */}
                        {isPaying && (
                          <div className="px-5 pb-4 border-t border-amber-200">
                            <form onSubmit={(e) => handlePaySubmit(e, p._id)} className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                              <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Amount (₹) *</label>
                                <input
                                  type="number"
                                  value={payForm.amount}
                                  onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none font-bold text-gray-900 text-sm focus:border-emerald-500"
                                  placeholder={`Max ₹${balance.toLocaleString()}`}
                                  max={balance}
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Method</label>
                                <select
                                  value={payForm.method}
                                  onChange={e => setPayForm({ ...payForm, method: e.target.value })}
                                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none font-bold text-gray-900 text-sm"
                                >
                                  {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'].map(m => <option key={m}>{m}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Note (optional)</label>
                                <input
                                  type="text"
                                  value={payForm.note}
                                  onChange={e => setPayForm({ ...payForm, note: e.target.value })}
                                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none font-bold text-gray-900 text-sm"
                                  placeholder="Cheque no. etc."
                                />
                              </div>
                              <button type="submit" disabled={paySubmitting} className="py-2.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all text-sm">
                                {paySubmitting ? 'Saving...' : '✓ Confirm'}
                              </button>
                            </form>
                          </div>
                        )}

                        {/* Payment History */}
                        {p.payments && p.payments.length > 0 && (
                          <div className="px-5 pb-3 border-t border-gray-100">
                            <p className="text-[10px] font-black uppercase text-gray-400 mt-2 mb-1.5">Payment History</p>
                            <div className="space-y-1">
                              {p.payments.map((pay, i) => (
                                <div key={i} className="flex justify-between items-center bg-white rounded-xl px-3 py-2 text-xs border border-gray-100">
                                  <div className="flex items-center gap-2">
                                    <span className="text-emerald-600 font-black">₹{pay.amount.toLocaleString()}</span>
                                    <span className="bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded text-[9px]">{pay.method}</span>
                                    {pay.note && <span className="text-gray-400 italic">{pay.note}</span>}
                                  </div>
                                  <span className="text-gray-400">{new Date(pay.paidAt).toLocaleDateString('en-IN')}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default Vendors;
