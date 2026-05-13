import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { printThermal } from '../utils/pdfGenerator';
import { exportInvoicesCSV } from '../utils/csvExport';
import { API } from '../utils/api';

const STATUS_STYLES = {
  Paid:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Unpaid:    'bg-rose-50 text-rose-600 border border-rose-200',
  Partial:   'bg-amber-50 text-amber-700 border border-amber-200',
  Cancelled: 'bg-gray-100 text-gray-500 border border-gray-300 line-through',
};

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null); // invoice object
  const [payForm, setPayForm] = useState({ amount: '', method: 'Cash', note: '' });
  const [paying, setPaying] = useState(false);

  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const userRole = userInfo.role || 'Admin';

  useEffect(() => { fetchInvoices(); }, []);

  const getConfig = () => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    return { headers: { Authorization: `Bearer ${userInfo.token}` } };
  };

  async function fetchInvoices() {
    try {
      const { data } = await axios.get(`${API}/invoices`, getConfig());
      setInvoices(data);
    } catch (error) {
      console.error('Error fetching invoices', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvoice = async (id) => {
    try {
      setUpdatingId(id);
      await axios.put(`${API}/invoices/${id}/cancel`, {}, getConfig());
      setInvoices(prev => prev.map(inv =>
        inv._id === id ? { ...inv, status: 'Cancelled' } : inv
      ));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to cancel invoice');
    } finally {
      setUpdatingId(null);
      setConfirmCancel(null);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      setUpdatingId(id);
      await axios.put(`${API}/invoices/${id}/status`, { status: newStatus }, getConfig());
      setInvoices(prev => prev.map(inv =>
        inv._id === id ? { ...inv, status: newStatus } : inv
      ));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddPayment = async () => {
    if (!payForm.amount || Number(payForm.amount) <= 0) return;
    setPaying(true);
    try {
      const { data } = await axios.post(
        `${API}/invoices/${paymentModal._id}/payments`,
        { amount: Number(payForm.amount), method: payForm.method, note: payForm.note },
        getConfig()
      );
      setInvoices(prev => prev.map(inv => inv._id === data._id ? data : inv));
      setPaymentModal(data);
      setPayForm({ amount: '', method: 'Cash', note: '' });
    } catch (err) {
      alert(err.response?.data?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleWhatsAppShare = (inv) => {
    const shopName = userInfo.shopName || "Our Shop";
    const custName = inv.customer?.name || 'Valued Customer';
    const invNo = inv.invoiceNumber || inv._id.substring(18).toUpperCase();
    const text = `Hello ${custName},\n\nThank you for shopping with ${shopName}!\n\nYour Invoice #${invNo} for ₹${inv.finalAmount.toLocaleString()} is ready.\nStatus: ${inv.status}\n\nHave a great day!`;
    
    const encodedText = encodeURIComponent(text);
    const mobile = inv.customer?.mobile || inv.customerMobile;
    const url = mobile 
      ? `https://wa.me/91${mobile}?text=${encodedText}` 
      : `https://wa.me/?text=${encodedText}`;
      
    window.open(url, '_blank');
  };

  const filteredInvoices = invoices.filter(inv => {
    const name = inv.customer?.name || '';
    const mobile = inv.customer?.mobile || inv.customerMobile || '';
    const searchLower = searchQuery.toLowerCase();
    return name.toLowerCase().includes(searchLower) || mobile.includes(searchLower);
  });

  const today = new Date().toLocaleDateString('en-IN');
  const todayInvoices = invoices.filter(inv => new Date(inv.createdAt).toLocaleDateString('en-IN') === today && inv.status !== 'Cancelled');
  const todayTotal = todayInvoices.reduce((sum, inv) => sum + (inv.finalAmount || 0), 0);
  const todayReceived = todayInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);

  return (
    <div className="space-y-8">
      {/* Confirm Cancel Modal */}
      {confirmCancel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full space-y-5 border border-red-100">
            <div className="text-4xl text-center">⚠️</div>
            <h2 className="text-xl font-black text-gray-900 text-center">Cancel Invoice?</h2>
            <p className="text-gray-500 text-center text-sm font-medium">
              This will mark the invoice as <span className="font-black text-red-600">Cancelled</span> and restore the product stock automatically.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCancel(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                Keep Invoice
              </button>
              <button
                onClick={() => handleCancelInvoice(confirmCancel)}
                disabled={updatingId === confirmCancel}
                className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black hover:bg-red-700 transition active:scale-95 disabled:opacity-60"
              >
                {updatingId === confirmCancel ? 'Cancelling...' : '🚫 Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Sales History</h1>
          <p className="text-gray-500 font-medium">Track all customer invoices and settlements</p>
        </div>
        
        {/* DAILY SHIFT SUMMARY */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-3xl shadow-lg shadow-blue-600/20 text-white flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🌅</div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Today's Shift</p>
              <p className="font-bold">{todayInvoices.length} Bills</p>
            </div>
          </div>
          <div className="w-px h-8 bg-white/20"></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Sales Total</p>
            <p className="font-black text-lg">₹{todayTotal.toLocaleString()}</p>
          </div>
          <div className="w-px h-8 bg-white/20"></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Received</p>
            <p className="font-black text-lg text-green-300">₹{todayReceived.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => exportInvoicesCSV(invoices)} className="px-5 py-3 rounded-2xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition text-sm">📥 CSV</button>
          <Link
            to="/invoices/new"
            className="bg-accent text-white px-8 py-3 rounded-2xl font-bold hover:shadow-xl hover:shadow-accent/20 transition-all active:scale-95"
          >
            + New Invoice
          </Link>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by customer name or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none transition-all font-medium"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl grayscale opacity-50">🔍</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b">
              <tr>
                <th className="px-8 py-5">Invoice Ref</th>
                <th className="px-8 py-5">Customer</th>
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Billed By</th>
                <th className="px-8 py-5">Amount</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-20 text-gray-400 font-bold">Loading invoices...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-20 text-gray-400">
                  <div className="text-4xl mb-2">📄</div>
                  <div className="font-bold">No invoices found</div>
                </td></tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv._id} className={`hover:bg-gray-50/50 transition-colors group ${inv.status === 'Cancelled' ? 'opacity-60' : ''}`}>
                    <td className="px-8 py-6">
                      <span className="font-mono text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                        #{inv._id.substring(18).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-bold text-gray-900 text-base">{inv.customer?.name || 'Walk-in Client'}</div>
                      <div className="text-xs text-accent font-bold">{inv.customer?.mobile || inv.customerMobile}</div>
                    </td>
                    <td className="px-8 py-6 text-gray-500 font-medium">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-6">
                      {userRole === 'Admin' ? (
                        <div className="font-bold text-gray-900">{inv.createdBy?.name || 'Admin'}</div>
                      ) : (
                        <div className="font-bold text-gray-900">You</div>
                      )}
                    </td>
                    <td className="px-8 py-6 font-black text-gray-900 text-base">
                      ₹{inv.finalAmount.toLocaleString()}
                    </td>
                    <td className="px-8 py-6">
                      {inv.status === 'Cancelled' ? (
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${STATUS_STYLES.Cancelled}`}>
                          🚫 Cancelled
                        </span>
                      ) : (
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${STATUS_STYLES[inv.status] || ''}`}>
                          {inv.status}
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => printThermal(inv)}
                          className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition text-xs font-bold"
                        >
                          🖨️ Print
                        </button>
                        <button
                          onClick={() => handleWhatsAppShare(inv)}
                          className="flex items-center gap-1 bg-[#25D366]/10 text-[#075E54] border border-[#25D366]/30 px-3 py-1.5 rounded-lg hover:bg-[#25D366]/20 transition text-xs font-bold"
                        >
                          💬 WhatsApp
                        </button>
                        {inv.status !== 'Cancelled' && (
                          <button
                            onClick={() => { setPaymentModal(inv); setPayForm({ amount: '', method: 'Cash', note: '' }); }}
                            className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition text-xs font-bold"
                          >
                            💳 Pay
                          </button>
                        )}
                        {inv.status !== 'Cancelled' && (
                          <Link
                            to={`/invoices/${inv._id}/edit`}
                            className="flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition text-xs font-bold"
                          >
                            ✏️ Edit
                          </Link>
                        )}
                        {inv.status !== 'Cancelled' && userRole === 'Admin' && (
                          <button
                            onClick={() => setConfirmCancel(inv._id)}
                            disabled={updatingId === inv._id}
                            className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition text-xs font-bold disabled:opacity-50"
                          >
                            🚫 Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Payment Ledger Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-gray-900">Payment Ledger</h2>
                <p className="text-sm text-gray-500 font-medium">{paymentModal.invoiceNumber || `#${paymentModal._id.substring(18).toUpperCase()}`} — {paymentModal.customer?.name}</p>
              </div>
              <button onClick={() => setPaymentModal(null)} className="text-gray-400 hover:text-gray-700 font-black text-2xl transition">✕</button>
            </div>
            <div className="p-6 space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-2xl p-3 text-center">
                  <p className="text-[10px] font-black uppercase text-gray-400">Total</p>
                  <p className="font-black text-gray-900">₹{paymentModal.finalAmount?.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                  <p className="text-[10px] font-black uppercase text-emerald-600">Paid</p>
                  <p className="font-black text-emerald-700">₹{(paymentModal.amountPaid || 0).toLocaleString()}</p>
                </div>
                <div className="bg-rose-50 rounded-2xl p-3 text-center">
                  <p className="text-[10px] font-black uppercase text-rose-600">Balance</p>
                  <p className="font-black text-rose-700">₹{Math.max(0, paymentModal.finalAmount - (paymentModal.amountPaid || 0)).toLocaleString()}</p>
                </div>
              </div>

              {/* Payment History */}
              {paymentModal.payments?.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 flex justify-between items-center">
                    Payment History
                    {paymentModal.status !== 'Paid' && (
                      <button onClick={() => {
                        const balance = paymentModal.finalAmount - (paymentModal.amountPaid || 0);
                        const text = `Dear ${paymentModal.customer?.name || 'Customer'},\n\nThis is a friendly reminder for the balance payment of ₹${balance.toLocaleString()} against Invoice #${paymentModal.invoiceNumber || paymentModal._id.substring(18).toUpperCase()}.\n\nTotal Bill: ₹${paymentModal.finalAmount.toLocaleString()}\nPaid: ₹${(paymentModal.amountPaid || 0).toLocaleString()}\nDue: ₹${balance.toLocaleString()}\n\nYou can pay via UPI to: ${userInfo.upiId || 'our shop'}.\n\nThank you!\n${userInfo.shopName}`;
                        window.open(`https://wa.me/91${paymentModal.customer?.mobile || paymentModal.customerMobile}?text=${encodeURIComponent(text)}`, '_blank');
                      }} className="text-[10px] text-blue-600 hover:underline">📲 Send WhatsApp Reminder</button>
                    )}
                  </p>
                  <div className="space-y-2">
                    {paymentModal.payments.map((p, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                        <div>
                          <span className="text-xs font-black text-gray-700">{p.method}</span>
                          {p.note && <span className="text-xs text-gray-400 ml-2">({p.note})</span>}
                          <p className="text-[10px] text-gray-400">{new Date(p.paidAt).toLocaleDateString('en-IN')}</p>
                        </div>
                        <span className="font-black text-emerald-700">₹{p.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* QR Code Section */}
              {paymentModal.status !== 'Paid' && userInfo.upiId && (
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center gap-4">
                  <div className="bg-white p-2 rounded-xl border border-blue-100">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`upi://pay?pa=${userInfo.upiId}&pn=${encodeURIComponent(userInfo.shopName || '')}&am=${paymentModal.finalAmount - (paymentModal.amountPaid || 0)}&cu=INR`)}`} 
                      alt="Payment QR"
                      className="w-20 h-20"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-black text-blue-900 uppercase tracking-widest">Scan & Pay via UPI</p>
                    <p className="text-[10px] text-blue-600 font-bold mt-0.5">{userInfo.upiId}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Scan this QR with PhonePe, GooglePay, or any UPI app to pay the balance of <b>₹{(paymentModal.finalAmount - (paymentModal.amountPaid || 0)).toLocaleString()}</b></p>
                  </div>
                </div>
              )}

              {/* Add Payment */}
              {paymentModal.status !== 'Paid' && paymentModal.status !== 'Cancelled' && (
                <div className="border-t border-gray-100 pt-5 space-y-4">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Record New Payment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Amount (₹)"
                      value={payForm.amount}
                      onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                      className="px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      max={paymentModal.finalAmount - (paymentModal.amountPaid || 0)}
                    />
                    <select
                      value={payForm.method}
                      onChange={e => setPayForm({ ...payForm, method: e.target.value })}
                      className="px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    >
                      {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={payForm.note}
                    onChange={e => setPayForm({ ...payForm, note: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                  <button
                    onClick={handleAddPayment}
                    disabled={paying || !payForm.amount}
                    className="w-full py-3 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition disabled:opacity-50 active:scale-95"
                  >
                    {paying ? 'Recording...' : '💳 Record Payment'}
                  </button>
                </div>
              )}
              {paymentModal.status === 'Paid' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-emerald-700 font-black">
                  ✅ Fully Paid
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
