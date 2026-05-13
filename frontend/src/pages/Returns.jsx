import { useState, useEffect } from 'react';
import axios from 'axios';
import { printReturnThermal } from '../utils/pdfGenerator';

const REASON_OPTIONS = ['Defective / Damaged Product','Wrong Product Delivered','Customer Changed Mind','Size / Fit Issue','Quality Not Satisfactory','Other'];
const STATUS_CONFIG = {
  Pending:  { style: 'bg-amber-50 text-amber-700 border border-amber-200' },
  Approved: { style: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  Rejected: { style: 'bg-red-50 text-red-600 border border-red-200' },
};

const Returns = () => {
  const [returns, setReturns] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    setUser(userInfo);
  }, []);

  // Form state
  const [mobileSearch, setMobileSearch] = useState('');
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [selectedItems, setSelectedItems] = useState({});
  const [reason, setReason] = useState(REASON_OPTIONS[0]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getConfig = () => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    return { headers: { Authorization: `Bearer ${userInfo.token}` } };
  };

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const [retRes, invRes] = await Promise.all([
        axios.get('http://localhost:5000/api/returns', getConfig()),
        // /shop-all: returns ALL shop invoices so any staff can process a return
        // for a bill created by another staff member
        axios.get('http://localhost:5000/api/invoices/shop-all', getConfig()),
      ]);
      setReturns(retRes.data);
      setInvoices(invRes.data.filter(inv => inv.status !== 'Cancelled'));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const handleMobileSearch = () => {
    if (!mobileSearch.trim()) { setFormError('Enter customer mobile number'); return; }
    const matched = invoices.filter(inv => inv.customer?.mobile === mobileSearch.trim());
    if (matched.length === 0) { setFormError('No invoices found for this mobile number'); setCustomerInvoices([]); return; }
    setCustomerInvoices(matched);
    setFormError('');
    setSelectedInvoice('');
    setInvoiceDetails(null);
    setSelectedItems({});
  };

  const handleInvoiceSelect = (invoiceId) => {
    setSelectedInvoice(invoiceId);
    setSelectedItems({});
    setInvoiceDetails(customerInvoices.find(i => i._id === invoiceId) || null);
  };

  const handleQtyChange = (productId, qty, maxR) => {
    const parsed = Math.min(Math.max(0, Number(qty)), maxR);
    setSelectedItems(prev => ({ ...prev, [productId]: { ...(prev[productId] || { condition: 'Good' }), qty: parsed } }));
  };

  const handleConditionChange = (productId, condition) => {
    setSelectedItems(prev => ({ ...prev, [productId]: { ...(prev[productId] || { qty: 0 }), condition } }));
  };

  const calculateRefund = () => {
    if (!invoiceDetails) return 0;
    const allItemsTotal = invoiceDetails.products.reduce((sum, p) => sum + p.total, 0);
    const invoiceDiscount = invoiceDetails.totalDiscount || 0;
    let total = 0;
    for (const [pId, d] of Object.entries(selectedItems)) {
      const item = invoiceDetails.products.find(p => (p.product?._id || p.product) === pId);
      if (item && (d.qty || 0) > 0) {
        const discountShare = allItemsTotal > 0 ? (item.total / allItemsTotal) * invoiceDiscount : 0;
        const effectiveTotal = item.total - discountShare;
        total += (effectiveTotal / item.quantity) * d.qty;
      }
    }
    return total;
  };

  const handleSubmit = async () => {
    const itemsToReturn = Object.entries(selectedItems)
      .filter(([, d]) => (d.qty || 0) > 0)
      .map(([productId, d]) => ({ productId, quantity: d.qty, condition: d.condition || 'Good' }));
    if (!selectedInvoice) return setFormError('Please select an invoice');
    if (itemsToReturn.length === 0) return setFormError('Select at least one product with quantity > 0');
    setSubmitting(true); setFormError('');
    try {
      const { data } = await axios.post('http://localhost:5000/api/returns', { invoiceId: selectedInvoice, returnedProducts: itemsToReturn, reason }, getConfig());
      setReturns(prev => [data, ...prev]);
      const { data: fresh } = await axios.get('http://localhost:5000/api/invoices', getConfig());
      setInvoices(fresh.filter(inv => inv.status !== 'Cancelled'));
      closeModal();
    } catch (err) { setFormError(err.response?.data?.message || 'Failed to create return'); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (returnId, newStatus) => {
    setUpdatingId(returnId);
    try {
      const { data } = await axios.put(`http://localhost:5000/api/returns/${returnId}/status`, { status: newStatus }, getConfig());
      setReturns(prev => prev.map(r => r._id === returnId ? data : r));
      const { data: fresh } = await axios.get('http://localhost:5000/api/invoices/shop-all', getConfig());
      setInvoices(fresh.filter(inv => inv.status !== 'Cancelled'));
    } catch (err) { alert(err.response?.data?.message || 'Failed to update status'); }
    finally { setUpdatingId(null); }
  };

  const closeModal = () => {
    setShowModal(false); setFormError(''); setMobileSearch(''); setCustomerInvoices([]);
    setSelectedInvoice(''); setInvoiceDetails(null); setSelectedItems({});
  };

  const totalRefundApproved = returns.filter(r => r.status === 'Approved').reduce((sum, r) => sum + r.totalRefund, 0);
  const pendingCount = returns.filter(r => r.status === 'Pending').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Return Management</h1>
          <p className="text-gray-500 font-medium">Returns start as <span className="text-amber-600 font-black">Pending</span> — Approve to restore stock (final action)</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-orange-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-orange-700 shadow-lg shadow-orange-500/20 transition-all active:scale-95">↩️ New Return</button>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-4 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
          <span className="text-3xl">⏳</span>
          <div>
            <div className="font-black text-amber-800">{pendingCount} Return{pendingCount > 1 ? 's' : ''} Awaiting Approval</div>
            <div className="text-amber-700 text-sm font-medium">Approve to restore stock. <strong>Once approved, it cannot be reversed.</strong></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {[
          { label: 'Total Returns', value: returns.length, icon: '↩️', color: 'from-orange-500 to-amber-400', shadow: 'shadow-orange-500/30' },
          { label: 'Pending', value: pendingCount, icon: '⏳', color: 'from-amber-500 to-yellow-400', shadow: 'shadow-amber-500/30' },
          { label: 'Approved', value: returns.filter(r => r.status === 'Approved').length, icon: '✅', color: 'from-emerald-500 to-teal-400', shadow: 'shadow-emerald-500/30' },
          { label: 'Refund Issued', value: `₹${totalRefundApproved.toLocaleString()}`, icon: '💸', color: 'from-red-500 to-rose-400', shadow: 'shadow-red-500/30' },
        ].map((c, i) => (
          <div key={i} className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.color} text-white text-xl flex items-center justify-center shadow-lg ${c.shadow} mb-4`}>{c.icon}</div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{c.label}</p>
            <h3 className="text-3xl font-black text-gray-900 tracking-tight">{c.value}</h3>
          </div>
        ))}
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b">
              <tr>
                <th className="px-6 py-5">Return ID</th>
                <th className="px-6 py-5">Customer</th>
                <th className="px-6 py-5">Products</th>
                <th className="px-6 py-5">Reason</th>
                <th className="px-6 py-5">Refund</th>
                <th className="px-6 py-5">Requested By</th>
                <th className="px-6 py-5">Date</th>
                <th className="px-6 py-5">Stock</th>
                <th className="px-6 py-5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="9" className="text-center py-20 text-gray-400 font-bold">Loading...</td></tr>
              ) : returns.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-20 text-gray-400"><div className="text-4xl mb-2">↩️</div><div className="font-bold">No returns yet</div></td></tr>
              ) : returns.map((ret) => {
                const isUpdating = updatingId === ret._id;
                return (
                  <tr key={ret._id} className={`hover:bg-gray-50/50 transition-colors ${ret.status === 'Pending' ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-6 py-5"><span className="font-mono text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">#{ret._id.substring(18).toUpperCase()}</span></td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-gray-900">{ret.customer?.name || 'Unknown'}</div>
                      <div className="text-xs text-blue-500 font-bold">{ret.customer?.mobile || '—'}</div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        {ret.returnedProducts.map((rp, i) => (
                          <div key={i} className="text-xs font-bold text-gray-700">
                            {rp.productName || rp.product?.name || 'Product'} ×{rp.quantity}
                            <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-black ${rp.condition === 'Defective' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              {rp.condition === 'Defective' ? '⚠️ Defective' : '✓ Good'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-gray-600 font-medium text-xs max-w-[130px]">{ret.reason}</td>
                    <td className="px-6 py-5 font-black text-gray-900">₹{ret.totalRefund.toFixed(0)}</td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-gray-900">{ret.createdBy?.name || 'Admin'}</div>
                    </td>
                    <td className="px-6 py-5 text-gray-500 font-medium text-xs">{new Date(ret.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-6 py-5">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${ret.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                        {ret.status === 'Approved' ? '📦 Restored' : '📦 Not Restored'}
                      </span>
                    </td>
                    <td className="px-6 py-5 sticky right-0 bg-white lg:bg-transparent shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.05)] lg:shadow-none">
                      {isUpdating ? (
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      ) : ret.status === 'Approved' ? (
                        <div className="flex gap-2">
                          <span className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">✅ Approved</span>
                          <button onClick={() => printReturnThermal(ret)} className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition">🖨️ Print</button>
                        </div>
                      ) : ret.status === 'Rejected' ? (
                        <div className="flex gap-2">
                          <span className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-red-50 text-red-600 border border-red-200">🚫 Rejected</span>
                          <button onClick={() => printReturnThermal(ret)} className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition">🖨️ Print</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {user?.role === 'Admin' ? (
                            <>
                              <button onClick={() => handleStatusChange(ret._id, 'Approved')} className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition">✅ Approve</button>
                              <button onClick={() => handleStatusChange(ret._id, 'Rejected')} className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition">🚫 Reject</button>
                            </>
                          ) : null}
                          <button onClick={() => printReturnThermal(ret)} className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition">🖨️ Print</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Return Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-gray-900">New Return Request</h2>
                <p className="text-amber-600 font-bold text-sm mt-1">⏳ Saved as Pending — stock restores only after Approval</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 font-black text-2xl transition">✕</button>
            </div>

            <div className="p-8 space-y-6">
              {/* Step 1: Mobile Number Search */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Step 1: Customer Mobile Number</label>
                <div className="flex gap-3">
                  <input type="text" placeholder="Enter customer mobile number..." value={mobileSearch}
                    onChange={(e) => setMobileSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleMobileSearch()}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none" />
                  <button onClick={handleMobileSearch} className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 transition">🔍 Search</button>
                </div>
              </div>

              {/* Step 2: Select Invoice */}
              {customerInvoices.length > 0 && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Step 2: Select Invoice ({customerInvoices.length} found)</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {customerInvoices.map(inv => (
                      <button key={inv._id} onClick={() => handleInvoiceSelect(inv._id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${selectedInvoice === inv._id ? 'border-orange-400 bg-orange-50 shadow-md' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-black text-gray-900">{inv.invoiceNumber || `#${inv._id.substring(18).toUpperCase()}`}</span>
                            <span className="text-xs text-gray-500 ml-2">{new Date(inv.createdAt).toLocaleDateString('en-IN')}</span>
                          </div>
                          <span className="font-black text-gray-900">₹{inv.finalAmount?.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span>{inv.products?.length} items · Status: <span className="font-bold">{inv.status}</span></span>
                          {inv.createdBy?.name && (
                            <span className="bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded border border-blue-100">
                              Billed by: {inv.createdBy.name}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Select Products */}
              {invoiceDetails && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Step 3: Select Products to Return</label>
                  <div className="space-y-3">
                    {invoiceDetails.products.map((item, i) => {
                      const pId = item.product?._id || item.product;
                      const pName = item.product?.name || 'Product';
                      const alreadyReturned = item.returnedQty || 0;
                      const maxR = item.quantity - alreadyReturned;
                      const curQty = selectedItems[pId]?.qty || 0;
                      const curCond = selectedItems[pId]?.condition || 'Good';
                      const fullyDone = maxR <= 0;
                      return (
                        <div key={i} className={`p-4 rounded-2xl border transition-all ${fullyDone ? 'border-gray-200 bg-gray-100 opacity-60' : curQty > 0 ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-black text-gray-900">{pName}{fullyDone && <span className="ml-2 text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-lg font-black">Fully Returned</span>}</div>
                              <div className="text-xs text-gray-500 font-medium">Purchased: {item.quantity} · Returned: <span className={alreadyReturned > 0 ? 'text-orange-600 font-bold' : ''}>{alreadyReturned}</span> · Returnable: <span className="font-bold text-emerald-600">{maxR}</span></div>
                            </div>
                            {!fullyDone && (
                              <div className="flex items-center gap-2 ml-4">
                                <button onClick={() => handleQtyChange(pId, curQty - 1, maxR)} className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-orange-200 font-black text-gray-700 transition flex items-center justify-center">−</button>
                                <span className="w-8 text-center font-black text-gray-900 text-lg">{curQty}</span>
                                <button onClick={() => handleQtyChange(pId, curQty + 1, maxR)} className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-orange-200 font-black text-gray-700 transition flex items-center justify-center">+</button>
                              </div>
                            )}
                          </div>
                          {curQty > 0 && (
                            <div className="mt-3 flex items-center gap-3 pt-3 border-t border-orange-200/50">
                              <span className="text-xs font-black text-gray-500">Condition:</span>
                              <button onClick={() => handleConditionChange(pId, 'Good')} className={`text-xs font-black px-3 py-1.5 rounded-xl transition ${curCond === 'Good' ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-400' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>✓ Good (Restock)</button>
                              <button onClick={() => handleConditionChange(pId, 'Defective')} className={`text-xs font-black px-3 py-1.5 rounded-xl transition ${curCond === 'Defective' ? 'bg-red-100 text-red-600 border-2 border-red-400' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>⚠️ Defective</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {calculateRefund() > 0 && (
                    <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex justify-between items-center">
                      <span className="font-black text-emerald-700 uppercase text-xs tracking-widest">Estimated Refund</span>
                      <span className="font-black text-emerald-800 text-xl">₹{calculateRefund().toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Return Reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none">
                  {REASON_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-bold text-sm">{formError}</div>}

              <div className="flex gap-3 pt-2">
                <button onClick={closeModal} className="flex-1 py-3 rounded-2xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-3 rounded-2xl bg-orange-600 text-white font-black hover:bg-orange-700 transition shadow-lg shadow-orange-500/20 disabled:opacity-50 active:scale-95">
                  {submitting ? 'Submitting...' : '⏳ Submit Return Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Returns;
