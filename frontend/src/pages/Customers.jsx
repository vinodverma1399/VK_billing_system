import { useState, useEffect } from 'react';
import axios from 'axios';
import { exportCustomersCSV } from '../utils/csvExport';
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

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [returns, setReturns] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ mobile: '', name: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statement, setStatement] = useState(null);
  const [statementData, setStatementData] = useState({ invoices: [], returns: [], loading: false });
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'requests'

  // Request modal state
  const [requestModal, setRequestModal] = useState(null); // { type: 'edit'|'delete', customer }
  const [requestForm, setRequestForm] = useState({ name: '', mobile: '', email: '', address: '' });
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [handlingId, setHandlingId] = useState(null);

  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const userRole = userInfo.role || 'Admin';

  const getConfig = () => ({ headers: { Authorization: `Bearer ${userInfo.token}` } });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      const calls = [
        axios.get(`${API}/customers`, getConfig()),
        axios.get(`${API}/invoices`, getConfig()),
        axios.get(`${API}/returns`, getConfig()),
      ];
      if (userRole === 'Admin') calls.push(axios.get(`${API}/customers/requests`, getConfig()));
      const results = await Promise.all(calls);
      setCustomers(results[0].data);
      setInvoices(results[1].data);
      setReturns(results[2].data);
      if (userRole === 'Admin') setChangeRequests(results[3].data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const getCustomerBalance = (customerId) => {
    const custInvoices = invoices.filter(inv => inv.customer?._id === customerId || inv.customer === customerId);
    const custReturns = returns.filter(ret => (ret.customer?._id === customerId || ret.customer === customerId) && ret.status === 'Approved');
    let totalOutstanding = 0;
    custInvoices.forEach(inv => {
      if (inv.status === 'Cancelled') return;
      const invReturns = custReturns.filter(r => r.invoice?._id === inv._id || r.invoice === inv._id);
      const refund = invReturns.reduce((sum, r) => sum + r.totalRefund, 0);
      const bal = (inv.finalAmount - refund) - (inv.amountPaid || 0);
      if (bal > 0) totalOutstanding += bal;
    });
    return totalOutstanding;
  };

  const openAdd = () => { setEditCustomer(null); setForm({ mobile: '', name: '', email: '', address: '' }); setError(''); setShowModal(true); };
  const openEdit = (c) => { setEditCustomer(c); setForm({ mobile: c.mobile, name: c.name, email: c.email || '', address: c.address || '' }); setError(''); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.mobile || !form.name) return setError('Mobile and name required');
    setSaving(true); setError('');
    try {
      if (editCustomer) {
        const { data } = await axios.put(`${API}/customers/${editCustomer._id}`, form, getConfig());
        setCustomers(prev => prev.map(c => c._id === data._id ? data : c));
      } else {
        const { data } = await axios.post(`${API}/customers`, form, getConfig());
        setCustomers(prev => [data, ...prev]);
      }
      setShowModal(false);
    } catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    try {
      await axios.delete(`${API}/customers/${id}`, getConfig());
      setCustomers(prev => prev.filter(c => c._id !== id));
    } catch (e) { alert(e.response?.data?.message || 'Failed to delete'); }
  };

  // Staff submits a change request
  const openRequestModal = (type, customer) => {
    setRequestModal({ type, customer });
    setRequestForm({ name: customer.name, mobile: customer.mobile, email: customer.email || '', address: customer.address || '' });
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setRequestSubmitting(true);
    try {
      await axios.post(`${API}/customers/requests`, {
        customerId: requestModal.customer._id,
        type: requestModal.type,
        proposedData: requestModal.type === 'edit' ? requestForm : {}
      }, getConfig());
      alert(`✅ Request submitted! Admin will review and ${requestModal.type === 'edit' ? 'update' : 'delete'} this customer.`);
      setRequestModal(null);
    } catch (err) { alert(err.response?.data?.message || 'Failed to submit request'); }
    finally { setRequestSubmitting(false); }
  };

  // Admin handles a change request
  const handleRequest = async (reqId, action) => {
    setHandlingId(reqId);
    try {
      await axios.put(`${API}/customers/requests/${reqId}`, { action }, getConfig());
      setChangeRequests(prev => prev.filter(r => r._id !== reqId));
      if (action === 'approve') await fetchAll(); // refresh customer list too
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    finally { setHandlingId(null); }
  };

  const openStatement = async (customer) => {
    setStatement(customer);
    setStatementData({ invoices: [], returns: [], loading: true });
    try {
      const [invRes, retRes] = await Promise.all([
        axios.get(`${API}/invoices`, getConfig()),
        axios.get(`${API}/returns`, getConfig())
      ]);
      const cInv = invRes.data.filter(inv => inv.customer?._id === customer._id || inv.customer === customer._id);
      const cRet = retRes.data.filter(ret => (ret.customer?._id === customer._id || ret.customer === customer._id) && ret.status === 'Approved');
      setStatementData({ invoices: cInv, returns: cRet, loading: false });
    } catch (e) { setStatementData({ invoices: [], returns: [], loading: false }); }
  };

  const handleSendReminder = (customer, balance) => {
    const shopName = userInfo.shopName || 'Our Shop';
    const upiId = userInfo.upiId || '';
    const mobile = customer.mobile;

    // Build unpaid invoices list
    const unpaidInvoices = invoices.filter(inv => {
      const isThisCustomer = inv.customer?._id === customer._id || inv.customer === customer._id;
      const hasBalance = (inv.finalAmount - (inv.amountPaid || 0)) > 0;
      return isThisCustomer && hasBalance && inv.status !== 'Cancelled';
    });

    let msg = `Namaste *${customer.name}* ji! 🙏\n\n`;
    msg += `*${shopName}* ki taraf se yaad dila rahe hain:\n`;
    msg += `------------------------\n`;

    unpaidInvoices.forEach(inv => {
      const bal = (inv.finalAmount - (inv.amountPaid || 0));
      const invNum = inv.invoiceNumber || inv._id?.toString().slice(-6).toUpperCase();
      const status = inv.status;
      msg += `Bill: *${invNum}*\n`;
      msg += `Status: ${status} | Due: *₹${bal.toLocaleString()}*\n`;
      msg += `\n`;
    });

    msg += `------------------------\n`;
    msg += `*Total Baki: ₹${balance.toLocaleString()}*\n\n`;

    if (upiId) {
      const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${balance.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill Payment')}`;
      msg += `💳 *Online Payment Link:*\n${upiLink}\n\n`;
      msg += `👆 Is link par click karke GPay/PhonePe/Paytm se turant payment karein!\n\n`;
    }

    msg += `Aapka saath karte hain. Dhanyawad! 🙏\n`;
    msg += `*${shopName}*`;

    const whatsappUrl = `https://wa.me/91${mobile}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  };

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile?.includes(search)
  );

  const pendingRequestsCount = changeRequests.length;
  const inputClass = "w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all";

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Customers</h1>
          <p className="text-gray-500 font-medium">{customers.length} registered customers</p>
        </div>
        <div className="flex gap-3">
          {userRole === 'Admin' && (
            <button onClick={() => exportCustomersCSV(customers)} className="px-5 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition text-sm">
              ⬇️ Export CSV
            </button>
          )}
          <button onClick={openAdd} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 shadow-lg transition active:scale-95">
            + Add Customer
          </button>
        </div>
      </div>

      {/* Tabs — Admin only sees Requests tab */}
      {userRole === 'Admin' && (
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('customers')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${activeTab === 'customers' ? 'bg-gray-900 text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
            👥 Customers
          </button>
          <button onClick={() => setActiveTab('requests')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'requests' ? 'bg-amber-500 text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
            📋 Change Requests
            {pendingRequestsCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{pendingRequestsCount}</span>
            )}
          </button>
        </div>
      )}

      {/* ── CHANGE REQUESTS TAB (Admin) ── */}
      {activeTab === 'requests' && userRole === 'Admin' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-5 border-b bg-amber-50/50">
            <h2 className="font-black text-gray-900">Pending Customer Change Requests</h2>
            <p className="text-sm text-amber-700 font-medium">Staff has requested these edits/deletions — review and approve or reject.</p>
          </div>
          {changeRequests.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-2">✅</div>
              <div className="font-bold">No pending requests</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {changeRequests.map(req => (
                <div key={req._id} className="px-8 py-5 flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${req.type === 'delete' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {req.type === 'delete' ? '🗑️ Delete' : '✏️ Edit'}
                      </span>
                      <span className="font-black text-gray-900">{req.customer?.name}</span>
                      <span className="text-gray-400 text-xs">{req.customer?.mobile}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Requested by: <b>{req.requestedBy?.name}</b> · {new Date(req.createdAt).toLocaleDateString('en-IN')}
                    </p>
                    {req.type === 'edit' && req.proposedData && (
                      <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs space-y-0.5">
                        <p className="font-black text-blue-700 mb-1">Proposed Changes:</p>
                        {req.proposedData.name && <p>Name: <b>{req.proposedData.name}</b></p>}
                        {req.proposedData.mobile && <p>Mobile: <b>{req.proposedData.mobile}</b></p>}
                        {req.proposedData.email && <p>Email: <b>{req.proposedData.email}</b></p>}
                        {req.proposedData.address && <p>Address: <b>{req.proposedData.address}</b></p>}
                      </div>
                    )}
                    {req.type === 'delete' && (
                      <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-100 text-xs">
                        <p className="text-red-700 font-bold">⚠️ This will permanently delete <b>{req.customer?.name}</b> ({req.customer?.mobile})</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRequest(req._id, 'approve')}
                      disabled={handlingId === req._id}
                      className="px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition active:scale-95"
                    >
                      {handlingId === req._id ? '...' : '✅ Approve'}
                    </button>
                    <button
                      onClick={() => handleRequest(req._id, 'reject')}
                      disabled={handlingId === req._id}
                      className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-xs font-black rounded-xl hover:bg-red-100 disabled:opacity-50 transition active:scale-95"
                    >
                      🚫 Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CUSTOMERS LIST TAB ── */}
      {activeTab === 'customers' && (
        <>
          {/* Staff hint about pending requests */}
          {userRole === 'Staff' && (
            <div className="flex items-center gap-3 px-5 py-3 bg-blue-50 border border-blue-200 rounded-2xl text-blue-700 text-sm font-bold">
              ℹ️ You can view customers. To edit/delete, submit a request — Admin will review and approve.
            </div>
          )}

          <input type="text" placeholder="🔍 Search by name or mobile..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
                <tr>
                  <th className="px-8 py-5">Customer</th>
                  <th className="px-8 py-5">Mobile</th>
                  <th className="px-8 py-5">Purchases</th>
                  <th className="px-8 py-5">Balance</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan="5" className="text-center py-16 text-gray-400 font-bold">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-16 text-gray-400">
                    <div className="text-4xl mb-2">👥</div>
                    <div className="font-bold">No customers found</div>
                  </td></tr>
                ) : (
                  filtered.map(c => {
                    const bal = getCustomerBalance(c._id);
                    const custInvoices = invoices.filter(inv => inv.customer?._id === c._id || inv.customer === c._id);
                    return (
                      <tr key={c._id} className={`hover:bg-gray-50/50 transition-colors group ${bal > 0 ? 'bg-amber-50/30 border-l-4 border-l-amber-400' : ''}`}>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-black flex items-center justify-center flex-shrink-0">
                              {c.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="font-black text-gray-900">{c.name}</div>
                              {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 font-bold text-gray-700">
                          {c.mobile && (
                            <a 
                              href={`https://wa.me/91${c.mobile}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:text-[#25D366] hover:underline flex items-center gap-1.5 transition-colors"
                              title="Message on WhatsApp"
                            >
                              <span className="text-[#25D366] text-lg">💬</span> {c.mobile}
                            </a>
                          )}
                        </td>
                        <td className="px-8 py-5">
                          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-xl text-xs font-black">{custInvoices.length} bills</span>
                        </td>
                        <td className="px-8 py-5">
                          {bal > 0 ? (
                            <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-700 font-black text-xs border border-amber-200">₹{bal.toLocaleString()}</span>
                          ) : (
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 font-black text-xs border border-emerald-100">Cleared</span>
                          )}
                        </td>
                        <td className="px-8 py-5 sticky right-0 bg-white lg:bg-transparent shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.05)] lg:shadow-none">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {bal > 0 && (
                              <button
                                onClick={() => handleSendReminder(c, bal)}
                                className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-black hover:bg-green-100 transition flex items-center gap-1"
                                title="Send WhatsApp payment reminder with UPI link"
                              >
                                💬 Reminder
                              </button>
                            )}
                            <button onClick={() => openStatement(c)} className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-black hover:bg-gray-100 transition">📋 Statement</button>
                            {userRole === 'Admin' ? (
                              <>
                                <button onClick={() => openEdit(c)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition">✏️</button>
                                <button onClick={() => handleDelete(c._id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition">🗑️</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => openRequestModal('edit', c)} className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-black hover:bg-blue-100 transition">✏️ Request Edit</button>
                                <button onClick={() => openRequestModal('delete', c)} className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-200 rounded-xl text-xs font-black hover:bg-red-100 transition">🗑️ Request Delete</button>
                              </>
                            )}
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
        </>
      )}

      {/* Add/Edit Customer Modal (Admin only for edit) */}
      {showModal && (
        <Modal title={editCustomer ? 'Edit Customer' : 'New Customer'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-5">
            {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100">{error}</div>}
            {[
              { label: 'Mobile Number *', key: 'mobile', type: 'text', placeholder: '10-digit mobile' },
              { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'Customer name' },
              { label: 'Email (Optional)', key: 'email', type: 'email', placeholder: 'email@example.com' },
              { label: 'Address (Optional)', key: 'address', type: 'text', placeholder: 'Address' },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">{f.label}</label>
                <input type={f.type} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className={inputClass} placeholder={f.placeholder} />
              </div>
            ))}
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-gray-500 font-bold border border-gray-200 hover:bg-gray-50 rounded-2xl transition">Cancel</button>
              <button type="submit" disabled={saving} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all">
                {saving ? 'Saving...' : editCustomer ? 'Update Customer' : 'Add Customer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Staff Request Modal */}
      {requestModal && (
        <Modal title={requestModal.type === 'delete' ? '🗑️ Request Customer Deletion' : '✏️ Request Customer Edit'} onClose={() => setRequestModal(null)}>
          <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm font-bold">
            ⏳ This request will be sent to <b>Admin</b> for approval. The change will apply only after Admin approves.
          </div>
          {requestModal.type === 'delete' ? (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm">
                <p className="font-black text-red-700">You are requesting to delete:</p>
                <p className="mt-1 font-bold text-gray-900">{requestModal.customer.name} — {requestModal.customer.mobile}</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setRequestModal(null)} className="flex-1 py-4 text-gray-500 font-bold border border-gray-200 hover:bg-gray-50 rounded-2xl transition">Cancel</button>
                <button onClick={handleSubmitRequest} disabled={requestSubmitting}
                  className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 active:scale-95 disabled:opacity-50 transition-all">
                  {requestSubmitting ? 'Submitting...' : '🗑️ Submit Delete Request'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              {[
                { label: 'Name', key: 'name' },
                { label: 'Mobile', key: 'mobile' },
                { label: 'Email', key: 'email' },
                { label: 'Address', key: 'address' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">{f.label}</label>
                  <input type="text" value={requestForm[f.key]} onChange={e => setRequestForm({ ...requestForm, [f.key]: e.target.value })}
                    className={inputClass} />
                </div>
              ))}
              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setRequestModal(null)} className="flex-1 py-4 text-gray-500 font-bold border border-gray-200 hover:bg-gray-50 rounded-2xl transition">Cancel</button>
                <button type="submit" disabled={requestSubmitting}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all">
                  {requestSubmitting ? 'Submitting...' : '📋 Submit Edit Request'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Customer Statement Modal */}
      {statement && (
        <Modal title={`📋 ${statement.name} — Statement`} onClose={() => setStatement(null)} size="max-w-3xl">
          {statementData.loading ? <div className="text-center py-10 text-gray-400">Loading...</div> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Mobile', val: statement.mobile },
                  { label: 'Total Bills', val: statementData.invoices.length },
                  { label: 'Total Spent', val: `₹${statementData.invoices.reduce((s, i) => s + (i.finalAmount || 0), 0).toLocaleString()}` },
                  { label: 'Approved Returns', val: statementData.returns.length },
                ].map(s => (
                  <div key={s.label} className="p-3 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-black uppercase text-gray-400">{s.label}</p>
                    <p className="font-black text-gray-900">{s.val}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {(() => {
                  // Merge and sort all transactions
                  const transactions = [
                    ...statementData.invoices.map(inv => ({
                      date: new Date(inv.createdAt),
                      type: 'Sale',
                      id: inv.invoiceNumber || inv._id.slice(-6).toUpperCase(),
                      amount: inv.finalAmount,
                      status: inv.status,
                      raw: inv
                    })),
                    ...statementData.returns.map(ret => ({
                      date: new Date(ret.createdAt),
                      type: 'Return',
                      id: `RET-${ret._id.slice(-6).toUpperCase()}`,
                      amount: -ret.totalRefund,
                      status: ret.status,
                      raw: ret
                    }))
                  ].sort((a, b) => b.date - a.date);

                  if (transactions.length === 0) return <div className="text-center py-10 text-gray-400 font-bold">No transactions found</div>;

                  return transactions.map((t, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border flex justify-between items-center ${
                      t.type === 'Sale' ? (t.status === 'Paid' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-amber-50/50 border-amber-100') : 'bg-rose-50/50 border-rose-100'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                          t.type === 'Sale' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'
                        }`}>
                          {t.type === 'Sale' ? 'INV' : 'RET'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-gray-900 font-mono text-xs">{t.id}</span>
                            <span className="text-[10px] text-gray-400 font-bold">{t.date.toLocaleDateString('en-IN')}</span>
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-0.5">
                            {t.type === 'Sale' ? `Status: ${t.status}` : 'Stock Restored'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-black ${t.type === 'Sale' ? 'text-gray-900' : 'text-rose-600'}`}>
                          {t.amount > 0 ? `+ ₹${t.amount.toLocaleString()}` : `- ₹${Math.abs(t.amount).toLocaleString()}`}
                        </div>
                        {t.type === 'Sale' && t.status !== 'Paid' && (
                          <div className="text-[10px] font-bold text-amber-600">
                            Due: ₹{(t.amount - (t.raw.amountPaid || 0)).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="pt-4 border-t border-dashed flex justify-between items-center">
                <div className="text-gray-500 font-bold text-sm uppercase tracking-widest">Total Outstanding</div>
                <div className="text-2xl font-black text-gray-900">₹{getCustomerBalance(statement._id).toLocaleString()}</div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default Customers;
