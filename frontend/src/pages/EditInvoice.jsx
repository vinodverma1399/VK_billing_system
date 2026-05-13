import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { generateInvoicePDF, printThermal } from '../utils/pdfGenerator';

const EditInvoice = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const barcodeRef = useRef(null);

  const [invoice, setInvoice] = useState(null);
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [invoiceProducts, setInvoiceProducts] = useState([]);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [status, setStatus] = useState('Paid');
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const getConfig = () => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    return { headers: { Authorization: `Bearer ${userInfo.token}` } };
  };

  // Load existing invoice
  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const { data } = await axios.get('http://localhost:5000/api/invoices', getConfig());
        const found = data.find(inv => inv._id === id);
        if (!found) { navigate('/invoices'); return; }
        if (found.status === 'Cancelled') {
          setError('This invoice is cancelled and cannot be edited.');
          setLoading(false);
          return;
        }
        setInvoice(found);
        setCustomerMobile(found.customer?.mobile || '');
        setCustomerName(found.customer?.name || '');
        setTotalDiscount(found.totalDiscount || 0);
        setStatus(found.status || 'Paid');
        setAmountPaidInput(found.amountPaid || '');

        // Pre-fill products
        const prods = found.products.map(p => ({
          product: p.product?._id || p.product,
          name: p.product?.name || 'Product',
          price: p.price,
          gst: p.product?.gst ?? 0,
          stock: p.product?.stock ?? 0,
          quantity: p.quantity,
          discount: p.discount || 0,
        }));
        setInvoiceProducts(prods);
      } catch (e) {
        setError('Failed to load invoice.');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  useEffect(() => { barcodeRef.current?.focus(); }, [loading]);

  const handleBarcodeScan = async (e) => {
    e.preventDefault();
    if (!barcodeInput) return;
    try {
      const { data: product } = await axios.get(
        `http://localhost:5000/api/products/barcode/${barcodeInput}`,
        getConfig()
      );
      if (!product?._id) throw new Error('Invalid product');

      const existing = invoiceProducts.findIndex(p => p.product === product._id);
      if (existing >= 0) {
        const updated = [...invoiceProducts];
        const newQty = updated[existing].quantity + 1;
        if (newQty > product.stock) {
          setError(`Out of stock! Only ${product.stock} available for ${product.name}`);
          setBarcodeInput('');
          return;
        }
        updated[existing].quantity = newQty;
        setInvoiceProducts(updated);
        setError('');
      } else {
        if (1 > product.stock) {
          setError(`Out of stock! ${product.name} is not available in inventory.`);
          setBarcodeInput('');
          return;
        }
        setInvoiceProducts([...invoiceProducts, {
          product: product._id,
          name: product.name,
          price: product.price,
          gst: product.gst,
          stock: product.stock,
          quantity: 1,
          discount: 0,
        }]);
        setError('');
      }
      setBarcodeInput('');
      setError('');
    } catch (err) {
      setError(`Product "${barcodeInput}" not found`);
      setBarcodeInput('');
    }
  };

  const removeProduct = (idx) => {
    setInvoiceProducts(invoiceProducts.filter((_, i) => i !== idx));
  };

  const updateQuantity = (idx, qty) => {
    const updated = [...invoiceProducts];
    if (qty > updated[idx].stock) {
      setError(`Cannot exceed available stock (${updated[idx].stock}) for ${updated[idx].name}`);
      updated[idx].quantity = updated[idx].stock;
    } else {
      updated[idx].quantity = Math.max(1, qty);
      setError('');
    }
    setInvoiceProducts(updated);
  };

  const calculateSubtotal = () =>
    invoiceProducts.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const calculateGst = () =>
    invoiceProducts.reduce((sum, item) => {
      const base = item.price * item.quantity - (item.discount || 0);
      return sum + (base * item.gst) / 100;
    }, 0);

  const calculateFinal = () => calculateSubtotal() + calculateGst() - totalDiscount;

  const handleSave = async () => {
    if (invoiceProducts.length === 0) return setError('Add at least one product');
    setIsSaving(true);
    setError('');
    try {
      const { data } = await axios.put(
        `http://localhost:5000/api/invoices/${id}`,
        {
          products: invoiceProducts,
          totalDiscount: Number(totalDiscount) || 0,
          status,
          amountPaid: status === 'Paid' ? calculateFinal() : (status === 'Unpaid' ? 0 : (Number(amountPaidInput) || 0))
        },
        getConfig()
      );
      setInvoice(data);
      setShowSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickPay = async () => {
    if (!invoice) return;
    try {
      const balance = invoice.finalAmount - (invoice.amountPaid || 0);
      const { data } = await axios.post(
        `http://localhost:5000/api/invoices/${invoice._id}/payments`,
        { amount: balance, method: 'UPI', note: 'Quick pay from success screen' },
        getConfig()
      );
      setInvoice(data);
    } catch (err) {
      alert('Failed to update payment');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="text-5xl">🚫</div>
        <p className="text-red-600 font-bold text-lg">{error}</p>
        <button onClick={() => navigate('/invoices')} className="bg-gray-900 text-white px-6 py-2 rounded-xl font-bold">
          ← Back to Invoices
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 max-w-md w-full text-center">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-6">✓</div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">Invoice Updated!</h2>
            <p className="text-gray-500 mb-6 font-medium">Stock and totals have been recalculated automatically.</p>

            {invoice && invoice.status !== 'Paid' && userInfo.upiId && (
              <div className="mb-6 p-4 bg-blue-50 rounded-3xl border border-blue-100 flex flex-col items-center gap-3">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${userInfo.upiId}&pn=${encodeURIComponent(userInfo.shopName || '')}&am=${invoice.finalAmount - (invoice.amountPaid || 0)}&cu=INR`)}`} 
                  alt="Payment QR"
                  className="w-24 h-24 bg-white p-2 rounded-2xl border border-blue-100"
                />
                <div className="text-center">
                  <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Scan to Pay ₹{(invoice.finalAmount - (invoice.amountPaid || 0)).toLocaleString()}</p>
                </div>
                <button 
                  onClick={handleQuickPay}
                  className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-lg hover:bg-blue-700 transition active:scale-95 shadow-sm"
                >
                  ✅ Confirm Payment Received
                </button>
              </div>
            )}

            {invoice && invoice.status === 'Paid' && (
               <div className="mb-6 p-4 bg-emerald-50 rounded-3xl border border-emerald-100 text-emerald-700 font-black text-sm">
                 ✅ Payment Recorded Successfully
               </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => printThermal(invoice)}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                🖨️ Print Updated Invoice
              </button>
              <button
                onClick={() => navigate('/invoices')}
                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all"
              >
                ← Back to Invoices
              </button>
              <button
                onClick={() => setShowSuccess(false)}
                className="w-full text-gray-500 font-bold py-2 hover:underline"
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Edit Invoice</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">
            #{id.substring(18).toUpperCase()} — Customer: <span className="font-bold text-gray-800">{customerName || customerMobile}</span>
          </p>
        </div>
        <button onClick={() => navigate('/invoices')} className="text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1">
          ← Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Products */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          {/* Barcode Scanner */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-black text-gray-800 mb-4">Add / Scan Products</h2>
            <form onSubmit={handleBarcodeScan} className="flex gap-4">
              <input
                type="text"
                placeholder="Scan Barcode or Enter Product ID"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                ref={barcodeRef}
              />
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition">
                Add
              </button>
            </form>
            {error && <p className="text-red-500 text-sm mt-2 font-medium">{error}</p>}
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase font-bold border-b text-[10px] tracking-widest">
                <tr>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Qty</th>
                  <th className="px-6 py-4">GST%</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-right">Remove</th>
                </tr>
              </thead>
              <tbody>
                {invoiceProducts.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-900">{item.name}</td>
                    <td className="px-6 py-4">₹{item.price}</td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                        className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </td>
                    <td className="px-6 py-4">{item.gst}%</td>
                    <td className="px-6 py-4 text-right font-bold">
                      ₹{((item.price * item.quantity) + (((item.price * item.quantity) * item.gst) / 100)).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => removeProduct(idx)}
                        className="text-red-500 hover:text-red-700 font-black text-lg transition"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {invoiceProducts.length === 0 && (
                  <tr><td colSpan="6" className="text-center py-10 text-gray-400 font-medium">No products. Scan a barcode to add.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right — Summary & Save */}
        <div className="space-y-6">
          {/* Customer Info (read-only) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-black text-gray-800 mb-4">Customer Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Mobile</span>
                <span className="font-bold text-gray-900">{customerMobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Name</span>
                <span className="font-bold text-gray-900">{customerName || '—'}</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-black text-gray-800 mb-4">Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-bold">₹{calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total GST</span>
                <span className="font-bold text-orange-600">₹{calculateGst().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Discount</span>
                <input
                  type="number"
                  value={totalDiscount}
                  onChange={(e) => setTotalDiscount(Number(e.target.value))}
                  className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-right font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <select
                  value={status}
                  onChange={(e) => {
                     setStatus(e.target.value);
                     if (e.target.value === 'Paid') setAmountPaidInput(calculateFinal());
                     else if (e.target.value === 'Unpaid') setAmountPaidInput(0);
                  }}
                  className="px-3 py-1 border border-gray-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partial">Partial</option>
                </select>
              </div>
              {status === 'Partial' && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Amount Paid</span>
                  <input 
                    type="number" 
                    value={amountPaidInput} 
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                    className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-right font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="₹0"
                  />
                </div>
              )}
              <div className="pt-4 border-t flex justify-between items-center text-xl font-black text-gray-900">
                <span>Final Payable</span>
                <span className="text-blue-600">₹{calculateFinal().toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full mt-6 bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-500/30 disabled:opacity-50 active:scale-95"
            >
              {isSaving ? 'Saving Changes...' : '💾 Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditInvoice;
