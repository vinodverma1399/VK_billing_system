import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API } from '../utils/api';
import { printThermal } from '../utils/pdfGenerator';

const CreateQuotation = () => {
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [invoiceProducts, setInvoiceProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [error, setError] = useState('');
  const [lastQuotation, setLastQuotation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [filteredProducts, setFilteredProducts] = useState([]);

  const barcodeInputRef = useRef(null);
  const navigate = useNavigate();
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

  const getConfig = () => ({ headers: { Authorization: `Bearer ${userInfo.token}` } });

  useEffect(() => {
    fetchActiveProducts();
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  }, []);

  const fetchActiveProducts = async () => {
    try {
      const { data } = await axios.get(`${API}/products`, getConfig());
      setAllProducts(data.filter(p => p.status === 'active'));
    } catch (err) {
      console.error('Error fetching products', err);
    }
  };

  const handleBarcodeSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!barcodeInput.trim()) return;
    setError('');

    // If suggestions are open and Enter is pressed, select the active one
    if (showSuggestions && filteredProducts.length > 0) {
      selectProduct(filteredProducts[activeSuggestion]);
      return;
    }

    try {
      const { data: product } = await axios.get(`${API}/products/barcode/${encodeURIComponent(barcodeInput.trim())}`, getConfig());
      selectProduct(product);
    } catch (err) {
      setError(err.response?.data?.message || 'Product not found');
      setBarcodeInput('');
      setShowSuggestions(false);
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    }
  };

  const selectProduct = (product) => {
    if (!product || !product._id) return;
    
    const existingItem = invoiceProducts.find(p => p.product._id === product._id);
    if (existingItem) {
      setInvoiceProducts(invoiceProducts.map(p => 
        p.product._id === product._id ? { ...p, quantity: p.quantity + 1 } : p
      ));
    } else {
      setInvoiceProducts([...invoiceProducts, {
        product,
        quantity: 1,
        price: product.price,
        gst: product.gst,
        discount: 0
      }]);
    }
    setError('');
    setBarcodeInput('');
    setShowSuggestions(false);
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  };

  const onSearchChange = (e) => {
    const value = e.target.value;
    setBarcodeInput(value);
    
    if (value.trim()) {
      const filtered = allProducts.filter(p => 
        p.status === 'active' && 
        (p.name.toLowerCase().includes(value.toLowerCase()) || 
         (p.barcode && p.barcode.toLowerCase().includes(value.toLowerCase())))
      );
      setFilteredProducts(filtered);
      setShowSuggestions(true);
      setActiveSuggestion(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.keyCode === 13) { // Enter
      if (showSuggestions && filteredProducts.length > 0) {
        e.preventDefault();
        selectProduct(filteredProducts[activeSuggestion]);
      }
    } else if (e.keyCode === 38) { // Up arrow
      if (activeSuggestion === 0) return;
      setActiveSuggestion(activeSuggestion - 1);
    } else if (e.keyCode === 40) { // Down arrow
      if (activeSuggestion === filteredProducts.length - 1) return;
      setActiveSuggestion(activeSuggestion + 1);
    } else if (e.keyCode === 27) { // Escape
      setShowSuggestions(false);
    }
  };

  const updateQuantity = (index, value) => {
    const val = Number(value);
    if (val < 1) return;
    const updated = [...invoiceProducts];
    updated[index].quantity = val;
    setInvoiceProducts(updated);
  };

  const removeItem = (index) => {
    setInvoiceProducts(invoiceProducts.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    let subTotal = 0;
    let totalGst = 0;
    
    invoiceProducts.forEach(item => {
      const pTotal = item.price * item.quantity;
      const afterDiscount = pTotal - Number(item.discount || 0);
      const gstAmt = (afterDiscount * item.gst) / 100;
      subTotal += afterDiscount;
      totalGst += gstAmt;
    });

    const finalAmount = subTotal + totalGst - Number(totalDiscount);
    return { subTotal, totalGst, finalAmount };
  };

  const { subTotal, totalGst, finalAmount } = calculateTotals();

  const handleCreateQuotation = async () => {
    if (invoiceProducts.length === 0) return setError('Please add products to the quotation.');
    setSaving(true);
    setError('');

    try {
      const payload = {
        customerMobile,
        customerName,
        products: invoiceProducts.map(item => ({
          product: item.product._id,
          quantity: item.quantity,
          price: item.price,
          gst: item.gst,
          discount: item.discount
        })),
        totalDiscount
      };

      const { data } = await axios.post(`${API}/quotations`, payload, getConfig());
      
      setLastQuotation(data);
      setInvoiceProducts([]);
      setCustomerMobile('');
      setCustomerName('');
      setTotalDiscount(0);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create quotation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end bg-amber-50 p-6 rounded-3xl shadow-sm border border-amber-100">
        <div>
          <h1 className="text-3xl font-black text-amber-900 mb-2">Create Quotation (Kachha Bill)</h1>
          <p className="text-amber-700 font-medium">Estimate for customers. Does NOT deduct stock.</p>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100">
            <h2 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-widest">Scan or Search Product</h2>
            <form onSubmit={handleBarcodeSubmit} className="flex gap-4 relative">
              <div className="flex-1 relative">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={onSearchChange}
                  onKeyDown={onKeyDown}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Scan barcode or type name..."
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 transition-all outline-none font-bold text-lg"
                  autoComplete="off"
                />
                
                {showSuggestions && filteredProducts.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[999] max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    {filteredProducts.map((p, index) => (
                      <div
                        key={p._id}
                        className={`px-5 py-3 cursor-pointer flex justify-between items-center transition-colors ${
                          index === activeSuggestion ? 'bg-amber-50 border-l-4 border-amber-400' : 'hover:bg-gray-50'
                        }`}
                        onMouseDown={() => selectProduct(p)}
                        onMouseEnter={() => setActiveSuggestion(index)}
                      >
                        <div className="flex-1">
                          <div className="font-black text-gray-900 text-sm">
                            {p.name}
                            {p.barcode && <span className="ml-2 font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">#{p.barcode}</span>}
                          </div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{p.category || 'General'} • {p.unit || 'Pc'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-amber-600 text-sm">₹{p.price}</div>
                          <div className={`text-[10px] font-bold ${p.stock < 5 ? 'text-red-500' : 'text-emerald-600'}`}>
                            Stock: {p.stock}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="px-8 bg-amber-500 text-white font-bold rounded-2xl shadow-lg hover:bg-amber-600 hover:-translate-y-0.5 transition-all h-[60px]">
                Add
              </button>
            </form>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-widest">Quotation Items</h2>
            </div>
            {invoiceProducts.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-medium">Scan a barcode to add products</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Item</th>
                      <th className="px-6 py-4">Qty</th>
                      <th className="px-6 py-4">Price</th>
                      <th className="px-6 py-4">Total</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoiceProducts.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{item.product.name}</div>
                          <div className="text-[10px] text-gray-400 uppercase">{item.product.barcode || 'NO CODE'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQuantity(idx, item.quantity - 1)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-600">-</button>
                            <input type="number" value={item.quantity} onChange={(e) => updateQuantity(idx, e.target.value)} className="w-16 text-center font-bold bg-transparent border-none focus:ring-0" min="1" />
                            <button onClick={() => updateQuantity(idx, item.quantity + 1)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-600">+</button>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-600">₹{item.price}</td>
                        <td className="px-6 py-4 font-black text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => removeItem(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100">
            <h2 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-widest">Customer Details</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Mobile Number (Optional)" value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 transition-all outline-none font-bold" />
              <input type="text" placeholder="Customer Name (Optional)" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 transition-all outline-none font-bold" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100">
            <h2 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-widest">Summary</h2>
            <div className="space-y-3 mb-6 border-b border-gray-100 pb-6">
              <div className="flex justify-between text-gray-500 font-medium"><span>Subtotal</span><span>₹{subTotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-500 font-medium"><span>Total GST</span><span>₹{totalGst.toFixed(2)}</span></div>
              <div className="flex justify-between items-center text-gray-500 font-medium mt-2 pt-2 border-t border-gray-50">
                <span>Extra Discount (₹)</span>
                <input type="number" value={totalDiscount} onChange={e => setTotalDiscount(e.target.value)} className="w-24 px-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-right font-bold outline-none focus:border-amber-400" min="0" />
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-6">
              <span className="text-xl font-black text-gray-900">Final Estimate</span>
              <span className="text-3xl font-black text-amber-600">₹{finalAmount.toFixed(2)}</span>
            </div>

            <button
              onClick={handleCreateQuotation}
              disabled={invoiceProducts.length === 0 || saving}
              className="w-full py-4 bg-amber-500 text-white font-black rounded-2xl shadow-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 transition-all text-lg"
            >
              {saving ? 'Creating...' : 'Save Estimate'}
            </button>
          </div>

          {lastQuotation && (
            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 text-center animate-in zoom-in duration-300">
              <div className="text-amber-600 text-4xl mb-2">🧾</div>
              <h3 className="font-black text-amber-900 mb-1">Estimate Saved!</h3>
              <p className="text-sm font-medium text-amber-700 mb-4">#{lastQuotation.quotationNumber}</p>
              <div className="flex gap-2">
                <button onClick={() => printThermal(lastQuotation, userInfo)} className="flex-1 py-3 bg-white text-amber-600 font-bold rounded-xl border border-amber-200 hover:bg-amber-50 transition shadow-sm">
                  🖨️ Print Estimate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateQuotation;
