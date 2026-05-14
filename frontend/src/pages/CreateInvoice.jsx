import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API } from '../utils/api';

import { printThermal } from '../utils/pdfGenerator';

const CreateInvoice = () => {
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [invoiceProducts, setInvoiceProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('Unpaid');
  const [paymentMethod, setPaymentMethod] = useState('Unpaid'); // Unpaid | Cash | UPI | Partial
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const barcodeRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    barcodeRef.current?.focus();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo'));
      const { data } = await axios.get(`${API}/products`, {
        headers: { Authorization: `Bearer ${userInfo.token}` }
      });
      setAllProducts(data);
    } catch (err) { console.error('Failed to load products for suggestions'); }
  };

  const handleBarcodeScan = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo'));
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      
      const { data: product } = await axios.get(`${API}/products/barcode/${barcodeInput.trim()}`, config);
      
      if (!product || !product._id) throw new Error('Product not found');
      
      const existingIndex = invoiceProducts.findIndex(p => p.product === product._id);
      
      if (existingIndex >= 0) {
        const updated = [...invoiceProducts];
        const newQty = updated[existingIndex].quantity + 1;
        if (newQty > product.stock) {
          setError(`⚠️ Only ${product.stock} in stock for "${product.name}"`);
          setBarcodeInput('');
          barcodeRef.current?.focus();
          return;
        }
        updated[existingIndex].quantity = newQty;
        setInvoiceProducts(updated);
      } else {
        if (product.stock < 1) {
          setError(`⚠️ "${product.name}" is out of stock!`);
          setBarcodeInput('');
          barcodeRef.current?.focus();
          return;
        }
        setInvoiceProducts([...invoiceProducts, {
          product: product._id,
          name: product.name,
          category: product.category,
          price: product.price,
          gst: product.gst,
          stock: product.stock,
          unit: product.unit || 'Piece',
          quantity: 1,
          discount: 0
        }]);
      }
      setError('');
      setBarcodeInput('');
      // Auto-focus back for next scan — critical for barcode gun workflow
      setTimeout(() => barcodeRef.current?.focus(), 50);
    } catch (err) {
      setError(err.response?.data?.message || `"${barcodeInput}" not found in inventory`);
      setBarcodeInput('');
      setTimeout(() => barcodeRef.current?.focus(), 50);
    }
  };

  const updateQuantity = (index, qty) => {
    const updated = [...invoiceProducts];
    if (qty > updated[index].stock) {
      setError(`Cannot exceed available stock (${updated[index].stock}) for ${updated[index].name}`);
      updated[index].quantity = updated[index].stock;
    } else {
      updated[index].quantity = qty;
      setError('');
    }
    setInvoiceProducts(updated);
  };

  const calculateSubtotal = () => {
    return invoiceProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateGst = () => {
    return invoiceProducts.reduce((sum, item) => {
      const amountBeforeTax = (item.price * item.quantity);
      return sum + ((amountBeforeTax * item.gst) / 100);
    }, 0);
  };

  const calculateFinal = () => {
    return calculateSubtotal() + calculateGst() - totalDiscount;
  };

  const [showSuccess, setShowSuccess] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);

  const handleCreateInvoice = async () => {
    if (!customerMobile) return setError('Customer mobile is required');
    if (invoiceProducts.length === 0) return setError('Add at least one product');

    setIsGenerating(true);
    setError('');
    
    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo'));
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      
      const { data: createdInvoice } = await axios.post(`${API}/invoices`, {
        customerMobile,
        customerName,
        products: invoiceProducts,
        totalDiscount: Number(totalDiscount) || 0,
        status,
        amountPaid: status === 'Paid' ? calculateFinal() : (status === 'Unpaid' ? 0 : (Number(amountPaidInput) || 0)),
        paymentMethod: paymentMethod !== 'Unpaid' ? paymentMethod : undefined
      }, config);

      setLastInvoice(createdInvoice);
      setShowSuccess(true);
      setIsGenerating(false);

      // Auto-print thermal receipt
      try {
        printThermal(createdInvoice);
      } catch (e) { console.error(e); }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create invoice');
      setIsGenerating(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (!lastInvoice) return;
    const shopName = userInfo.shopName || "Our Shop";
    const custName = lastInvoice.customer?.name || 'Valued Customer';
    const invNo = lastInvoice.invoiceNumber || lastInvoice._id.substring(18).toUpperCase();
    const text = `Hello ${custName},\n\nThank you for shopping with ${shopName}!\n\nYour Invoice #${invNo} for ₹${lastInvoice.finalAmount.toLocaleString()} is ready.\nStatus: ${lastInvoice.status}\n\nHave a great day!`;
    
    const encodedText = encodeURIComponent(text);
    const mobile = lastInvoice.customer?.mobile || customerMobile;
    const url = mobile 
      ? `https://wa.me/91${mobile}?text=${encodedText}` 
      : `https://wa.me/?text=${encodedText}`;
      
    window.open(url, '_blank');
  };

  const getConfig = () => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    return { headers: { Authorization: `Bearer ${userInfo.token}` } };
  };

  const handleQuickPay = async () => {
    if (!lastInvoice) return;
    try {
      const balance = lastInvoice.finalAmount - (lastInvoice.amountPaid || 0);
      const { data } = await axios.post(
        `${API}/invoices/${lastInvoice._id}/payments`,
        { amount: balance, method: 'UPI', note: 'Quick pay from success screen' },
        getConfig()
      );
      setLastInvoice(data);
    } catch (err) {
      alert('Failed to update payment');
    }
  };

  return (
    <div className="relative">
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 max-w-md w-full text-center animate-in zoom-in fade-in duration-300">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-6">
              ✓
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">Invoice Created!</h2>
            <p className="text-gray-500 mb-6 font-medium">Transaction settled successfully. Your digital bill is ready.</p>
            
            {lastInvoice && lastInvoice.status !== 'Paid' && userInfo.upiId && (
              <div className="mb-6 p-4 bg-blue-50 rounded-3xl border border-blue-100 flex flex-col items-center gap-3">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${userInfo.upiId}&pn=${encodeURIComponent(userInfo.shopName || '')}&am=${lastInvoice.finalAmount - (lastInvoice.amountPaid || 0)}&cu=INR`)}`} 
                  alt="Payment QR"
                  className="w-32 h-32 bg-white p-2 rounded-2xl border border-blue-100"
                />
                <div className="text-center">
                  <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Scan to Pay ₹{(lastInvoice.finalAmount - (lastInvoice.amountPaid || 0)).toLocaleString()}</p>
                  <p className="text-[10px] text-blue-600 font-bold">{userInfo.upiId}</p>
                </div>
                <button 
                  onClick={handleQuickPay}
                  className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-lg hover:bg-blue-700 transition active:scale-95 shadow-sm"
                >
                  ✅ Confirm Payment Received
                </button>
              </div>
            )}

            {lastInvoice && lastInvoice.status === 'Paid' && (
               <div className="mb-6 p-4 bg-emerald-50 rounded-3xl border border-emerald-100 text-emerald-700 font-black text-sm">
                 ✅ Payment Recorded Successfully
               </div>
            )}

            <div className="space-y-4">
              <button 
                onClick={() => printThermal(lastInvoice)}
                className="w-full bg-accent text-white py-4 rounded-2xl font-bold hover:shadow-xl hover:shadow-accent/20 transition-all flex items-center justify-center gap-2"
              >
                <span>🖨️</span> Print Receipt Again
              </button>
              <button 
                onClick={handleWhatsAppShare}
                className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold hover:shadow-xl hover:shadow-[#25D366]/20 transition-all flex items-center justify-center gap-2"
              >
                <span>💬</span> Send on WhatsApp
              </button>
              <button 
                onClick={() => navigate('/invoices')}
                className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                Go to Sales History
              </button>
              <button 
                onClick={() => {
                   setShowSuccess(false);
                   setInvoiceProducts([]);
                   setCustomerMobile('');
                   setCustomerName('');
                   setTotalDiscount(0);
                   setStatus('Unpaid');
                   setPaymentMethod('Unpaid');
                   setAmountPaidInput('');
                 }}
                className="w-full text-accent font-bold py-2 hover:underline"
              >
                Create New Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Product Scanning & List */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/10 rounded-2xl flex items-center justify-center text-xl">🔍</div>
                <div>
                  <h2 className="text-base font-black text-gray-900">Scan / Search Product</h2>
                  <p className="text-xs text-gray-400">Use barcode gun or type product name / barcode</p>
                </div>
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-accent font-bold text-sm text-gray-700"
              >
                <option value="All">All Categories</option>
                {[...new Set(allProducts.map(p => p.category || 'Uncategorized'))].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <form onSubmit={handleBarcodeScan} className="flex gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">📷</span>
                <input
                  type="text"
                  list="product-list"
                  placeholder="Scan barcode  OR  type product name..."
                  className="w-full pl-11 pr-4 py-3.5 border-2 border-accent/30 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none font-bold text-gray-900 bg-accent/5 placeholder-gray-400 transition-all"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  ref={barcodeRef}
                  autoComplete="off"
                  autoFocus
                />
                <datalist id="product-list">
                  {allProducts.filter(p => p.status !== 'pending' && (selectedCategory === 'All' || p.category === selectedCategory)).map((p) => (
                    <option key={p._id} value={p.barcode || p.name}>
                      {p.name} {p.barcode ? `[${p.barcode}]` : ''} — ₹{p.price} / {p.unit || 'Piece'} (Stock: {p.stock})
                    </option>
                  ))}
                </datalist>
              </div>
              <button type="submit"
                className="bg-accent text-white px-7 py-3.5 rounded-2xl font-black hover:bg-accent/90 active:scale-95 transition-all shadow-lg shadow-accent/20 flex items-center gap-2">
                ➕ Add
              </button>
            </form>
            {error && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-bold">
                ⚠️ {error}
              </div>
            )}
            {/* Quick product chips */}
            {allProducts.length > 0 && !barcodeInput && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-[10px] font-black uppercase text-gray-400 flex items-center">Quick add:</span>
                {allProducts
                  .filter(p => p.stock > 0 && p.status !== 'pending' && (selectedCategory === 'All' || p.category === selectedCategory))
                  .slice(0, 10)
                  .map(p => (
                  <button key={p._id} type="button"
                    onClick={() => { setBarcodeInput(p.barcode || p.name); setTimeout(() => barcodeRef.current?.form?.requestSubmit(), 50); }}
                    className="text-xs bg-gray-100 hover:bg-accent hover:text-white text-gray-700 font-bold px-3 py-1.5 rounded-xl transition-all border border-gray-200">
                    {p.name} — ₹{p.price}/{p.unit || 'Piece'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && null /* already shown above */}


          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b">
                <tr>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Qty</th>
                  <th className="px-6 py-4">GST%</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoiceProducts.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="px-6 py-4 text-gray-500 font-medium">{item.category || '-'}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{item.name}</td>
                    <td className="px-6 py-4">₹{item.price}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          value={item.quantity} 
                          onChange={(e) => updateQuantity(idx, e.target.value)}
                          className="w-16 px-2 py-1 border rounded text-center"
                        />
                        <span className="text-xs text-gray-500 font-bold">{item.unit || 'Piece'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{item.gst}%</td>
                    <td className="px-6 py-4 text-right font-medium">
                      ₹{((Number(item.price) * Number(item.quantity)) + ((Number(item.price) * Number(item.quantity)) * (Number(item.gst) / 100))).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {invoiceProducts.length === 0 && (
                  <tr><td colSpan="6" className="text-center py-8 text-gray-500">No products added. Scan barcode to begin.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column - Customer & Summary */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Customer Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-accent"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (Optional)</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-accent"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 bg-gray-50/50">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">₹{calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total GST</span>
                <span className="font-medium">₹{calculateGst().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Discount</span>
                <input 
                  type="number" 
                  value={totalDiscount} 
                  onChange={(e) => setTotalDiscount(Number(e.target.value))}
                  className="w-24 px-2 py-1 border rounded text-right"
                />
              </div>
              <div className="pt-4 border-t flex justify-between items-center text-lg font-bold text-gray-900">
                <span>Final Payable</span>
                <span className="text-primary">₹{calculateFinal().toFixed(2)}</span>
              </div>
              
              {/* ── Payment Method ── */}
              <div className="pt-3 border-t border-dashed">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'Unpaid', label: '⏳ Unpaid', color: 'border-amber-300 bg-amber-50 text-amber-700' },
                    { key: 'Cash',   label: '💵 Cash',   color: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
                    { key: 'UPI',    label: '📱 UPI',    color: 'border-blue-400 bg-blue-50 text-blue-700' },
                    { key: 'Partial',label: '🔄 Partial',color: 'border-purple-400 bg-purple-50 text-purple-700' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(opt.key);
                        if (opt.key === 'Cash' || opt.key === 'UPI') {
                          setStatus('Paid');
                          setAmountPaidInput(calculateFinal());
                        } else if (opt.key === 'Unpaid') {
                          setStatus('Unpaid');
                          setAmountPaidInput(0);
                        } else {
                          setStatus('Partial');
                          setAmountPaidInput('');
                        }
                      }}
                      className={`py-2.5 px-3 rounded-xl border-2 font-black text-xs transition-all ${
                        paymentMethod === opt.key
                          ? opt.color + ' shadow-md scale-[1.03]'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Partial amount input */}
              {paymentMethod === 'Partial' && (
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-600 text-sm font-bold">Amount Paid (₹)</span>
                  <input
                    type="number"
                    value={amountPaidInput}
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                    className="w-28 px-3 py-1.5 border-2 border-purple-300 rounded-xl text-right font-black outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                    placeholder="₹0"
                  />
                </div>
              )}

              {/* UPI QR — only shown when UPI selected */}
              {paymentMethod === 'UPI' && userInfo.upiId && (
                <div className="mt-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl flex flex-col items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Scan to Pay</p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`upi://pay?pa=${userInfo.upiId}&pn=${encodeURIComponent(userInfo.shopName || '')}&am=${calculateFinal().toFixed(2)}&cu=INR`)}`}
                    alt="UPI QR"
                    className="w-32 h-32 bg-white p-2 rounded-xl border border-blue-200 shadow-sm"
                  />
                  <p className="text-[10px] font-bold text-blue-600">{userInfo.upiId}</p>
                  <p className="text-sm font-black text-blue-800">₹{calculateFinal().toFixed(2)}</p>
                </div>
              )}

              {paymentMethod === 'UPI' && !userInfo.upiId && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-bold">
                  ⚠️ UPI ID not set. Go to Shop Profile to add it.
                </div>
              )}
            </div>
            <button 
              onClick={handleCreateInvoice}
              disabled={isGenerating}
              className="w-full mt-6 bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
            >
              {isGenerating ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateInvoice;
