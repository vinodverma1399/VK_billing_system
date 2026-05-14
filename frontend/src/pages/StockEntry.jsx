import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { API } from '../utils/api';

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
      <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-b">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
      </div>
      <div className="p-6 max-h-[80vh] overflow-y-auto">
        {children}
      </div>
    </div>
  </div>
);

const StockEntry = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [items, setItems] = useState([{ category: '', product: '', quantity: 1, purchasePrice: 0 }]);
  const [amountPaid, setAmountPaid] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Quick Add Product State
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [productError, setProductError] = useState('');
  const [newProductForm, setNewProductForm] = useState({ name: '', category: '', unit: 'Piece', price: '', gst: '0', barcode: '', costPrice: '0' });

  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const userRole = userInfo.role || 'Admin';

  const getConfig = () => {
    return { headers: { Authorization: `Bearer ${userInfo.token}` } };
  };

  useEffect(() => {
    fetchPurchases();
    fetchInitialData();
  }, []);

  async function fetchPurchases() {
    try {
      const { data } = await axios.get(`${API}/purchases`, getConfig());
      setPurchases(data);
    } catch (error) {
      console.error('Error fetching purchases', error);
    } finally {
      setLoading(false);
    }
  };

  async function fetchInitialData() {
    try {
      const [vRes, pRes, cRes] = await Promise.all([
        axios.get(`${API}/vendors`, getConfig()),
        axios.get(`${API}/products`, getConfig()),
        axios.get(`${API}/categories`, getConfig())
      ]);
      setVendors(vRes.data);
      setProducts(pRes.data);
      setCategories(cRes.data);
    } catch (err) {
      console.error('Error fetching initial data', err);
    }
  };

  const addItem = () => {
    setItems([...items, { category: '', product: '', quantity: 1, purchasePrice: 0 }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return; // Prevent multiple submissions
    
    if (!selectedVendor) return setError('Please select a vendor');
    if (items.some(item => !item.product || item.quantity <= 0)) return setError('Please fill all item details correctly');

    setSaving(true);
    try {
      await axios.post(`${API}/purchases`, {
        vendorId: selectedVendor,
        products: items,
        amountPaid: Number(amountPaid) || 0
      }, getConfig());
      
      setShowModal(false);
      // Reset form immediately
      setSelectedVendor('');
      setItems([{ category: '', product: '', quantity: 1, purchasePrice: 0 }]);
      setAmountPaid('');
      setError('');
      
      // Refresh the list to show the new entry
      await fetchPurchases();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving stock entry');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddProduct = async (e) => {
    e.preventDefault();
    setProductSaving(true);
    setProductError('');
    try {
      const payload = {
        name: newProductForm.name,
        category: newProductForm.category || (categories.length > 0 ? categories[0].name : ''),
        unit: newProductForm.unit,
        price: Number(newProductForm.price),
        gst: Number(newProductForm.gst),
        barcode: newProductForm.barcode,
        stock: 0,
        costPrice: Number(newProductForm.costPrice),
        lowStockThreshold: 5
      };
      
      const { data } = await axios.post(`${API}/products`, payload, getConfig());
      
      setProducts(prev => [...prev, data]);
      setShowProductModal(false);
      setNewProductForm({ name: '', category: categories.length > 0 ? categories[0].name : '', unit: 'Piece', price: '', gst: '0', barcode: '', costPrice: '0' });
      alert("Product added successfully! You can now select it from the dropdown.");
    } catch (err) {
      setProductError(err.response?.data?.message || 'Error adding product');
    } finally {
      setProductSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Purchase History</h1>
          <p className="text-sm text-gray-500">Manage vendor stock entries and inventory updates</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-accent text-accent-foreground px-5 py-2.5 rounded-xl font-semibold hover:opacity-90 transition shadow-lg shadow-blue-500/20"
        >
          + Add Stock Entry
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/50 text-gray-600 uppercase text-[10px] font-bold border-b">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Vendor</th>
              <th className="px-6 py-4">Entered By</th>
              <th className="px-6 py-4">Products & Pricing</th>
              {userRole === 'Admin' && <th className="px-6 py-4 text-right">Investment / Status</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={userRole === 'Admin' ? "5" : "4"} className="text-center py-12 text-gray-400">Loading history...</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={userRole === 'Admin' ? "5" : "4"} className="text-center py-12 text-gray-400 text-base">No purchase records found</td></tr>
            ) : (
              purchases.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50/50 transition align-top">
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{p.vendor?.name}</div>
                    <div className="text-xs text-gray-500">{p.vendor?.mobile}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{p.createdBy?.name || 'Admin'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      {p.products.map((item, idx) => (
                        <div key={idx} className="flex justify-between gap-8 text-xs border-b border-gray-50 pb-1 last:border-0">
                          <span className="text-gray-700 font-medium">
                            <span className="text-gray-400 text-[10px] mr-1 uppercase">{item.product?.category || '-'}</span>
                            {item.product?.name}
                          </span>
                          <span className="text-gray-500">
                            {item.quantity} {item.product?.unit || 'Piece'} x ₹{item.purchasePrice?.toLocaleString()} = 
                            <span className="text-gray-900 font-bold ml-1">₹{item.total?.toLocaleString()}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  {userRole === 'Admin' && (
                    <td className="px-6 py-4 text-right">
                      <div className="font-black text-gray-900 text-lg mb-1">
                        ₹{p.totalCost.toLocaleString()}
                      </div>
                      {p.status === 'Paid' ? (
                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Paid</span>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Pending (₹{(p.totalCost - (p.amountPaid || 0)).toLocaleString()})</span>
                          <span className="text-[9px] text-gray-400 italic">Pay from Vendors page</span>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <Modal title="New Stock Entry" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 animate-shake">{error}</div>}
            
            {vendors.length === 0 ? (
              <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                <p className="text-amber-800 font-bold mb-3">No Vendors Found!</p>
                <p className="text-amber-600 text-xs mb-4">You need to add a supplier before you can record stock entries.</p>
                <Link to="/vendors" className="inline-block bg-amber-500 text-white px-6 py-2 rounded-xl font-bold text-sm">Add Vendor First</Link>
              </div>
            ) : products.length === 0 ? (
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                <p className="text-blue-800 font-bold mb-3">No Products Registered!</p>
                <p className="text-blue-600 text-xs mb-4">Please add products to your inventory before creating stock entries.</p>
                <Link to="/products" className="inline-block bg-blue-500 text-white px-6 py-2 rounded-xl font-bold text-sm">Add Product First</Link>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Select Supplier / Vendor</label>
                  <select 
                    value={selectedVendor}
                    onChange={e => setSelectedVendor(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold"
                    required
                  >
                    <option value="">Choose from your vendors...</option>
                    {vendors.map(v => (
                      <option key={v._id} value={v._id}>{v.name} ({v.mobile})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Stock Items</label>
                    <button type="button" onClick={addItem} className="text-xs font-black text-accent hover:underline uppercase tracking-tighter">+ Add New Row</button>
                  </div>
                  
                  {items.map((item, index) => (
                    <div key={index} className="flex flex-col gap-4 bg-gray-50/50 p-6 rounded-3xl border border-gray-100 relative group animate-in slide-in-from-right-4">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1.5fr] gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Filter Category</label>
                          <select
                            value={item.category}
                            onChange={e => {
                              updateItem(index, 'category', e.target.value);
                              updateItem(index, 'product', ''); // Reset product on category change
                            }}
                            className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent"
                          >
                            <option value="">All Categories...</option>
                            {categories.map(c => (
                              <option key={c._id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Product</label>
                            <button type="button" onClick={() => { setNewProductForm({...newProductForm, category: item.category || (categories[0]?.name || '')}); setShowProductModal(true); }} className="text-[10px] text-accent font-black hover:underline tracking-tighter uppercase">+ New Product</button>
                          </div>
                          <select
                            value={item.product}
                            onChange={e => updateItem(index, 'product', e.target.value)}
                            className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent"
                            required
                          >
                            <option value="">Select product...</option>
                            {products
                              .filter(p => !item.category || p.category === item.category)
                              .map(p => (
                              <option key={p._id} value={p._id}>
                                {p.category ? `[${p.category}] ` : ''}{p.name} (Stock: {p.stock} {p.unit || 'Piece'})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Quantity</label>
                            <input
                              type="number"
                              step="any"
                              value={item.quantity}
                              onChange={e => updateItem(index, 'quantity', e.target.value)}
                              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent"
                              min="0"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Buy Price</label>
                            <input
                              type="number"
                              step="any"
                              value={item.purchasePrice}
                              onChange={e => updateItem(index, 'purchasePrice', e.target.value)}
                              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent"
                              placeholder="0.00"
                              required
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <div className="text-[10px] font-black uppercase text-gray-300">Item Total: <span className="text-gray-900 ml-1">₹{(Number(item.quantity) * Number(item.purchasePrice)).toLocaleString()}</span></div>
                        {items.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => removeItem(index)}
                            className="text-xs font-bold text-red-400 hover:text-red-600 transition uppercase tracking-tighter"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center py-6 px-6 bg-gray-900 rounded-[2rem] text-white shadow-2xl shadow-gray-200 gap-6">
                  <div className="space-y-1 w-full sm:w-auto">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Purchase Value</p>
                    <p className="text-3xl font-black tracking-tighter text-blue-400">₹{items.reduce((acc, curr) => acc + (Number(curr.quantity) * Number(curr.purchasePrice)), 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">{items.length} Product Types</p>
                  </div>
                  {userRole === 'Admin' ? (
                    <div className="w-full sm:w-auto flex-1 max-w-xs">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Amount Paid Now (₹)</label>
                      <input
                        type="number"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        placeholder="Enter amount paid to vendor"
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-blue-400 focus:bg-white/20 transition-all"
                      />
                    </div>
                  ) : (
                    <div className="w-full sm:w-auto flex-1 max-w-xs text-right">
                      <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-lg border border-amber-400/20">
                        Will be saved as PENDING
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="flex-[2] py-4 bg-accent text-white font-black rounded-2xl hover:shadow-xl hover:shadow-accent/20 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {saving ? 'Processing Entry...' : '🚀 Finalize Stock Entry'}
                  </button>
                </div>
              </>
            )}
          </form>
        </Modal>
      )}

      {showProductModal && (
        <Modal title="📦 Quick Add New Product" onClose={() => setShowProductModal(false)}>
          <form onSubmit={handleQuickAddProduct} className="space-y-6">
            {productError && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100">{productError}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Product Name *</label>
                <input
                  type="text"
                  value={newProductForm.name}
                  onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold text-gray-700"
                  placeholder="e.g. Rice 1Kg Pack"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Category *</label>
                <select
                  value={newProductForm.category}
                  onChange={e => setNewProductForm({ ...newProductForm, category: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold text-gray-700"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c._id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Unit *</label>
                <select
                  value={newProductForm.unit}
                  onChange={e => setNewProductForm({ ...newProductForm, unit: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold text-gray-700"
                  required
                >
                  {['Piece', 'Meter', 'Liter', 'Kg', 'ML', 'Gm', 'Number', 'Pack', 'Box', 'Dozen'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Selling Price (₹) *</label>
                <input
                  type="number"
                  step="any"
                  value={newProductForm.price}
                  onChange={e => setNewProductForm({ ...newProductForm, price: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold text-gray-700"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">GST %</label>
                <select
                  value={newProductForm.gst}
                  onChange={e => setNewProductForm({ ...newProductForm, gst: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold text-gray-700"
                >
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Barcode (Optional)</label>
                <input
                  type="text"
                  value={newProductForm.barcode}
                  onChange={e => setNewProductForm({ ...newProductForm, barcode: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold text-gray-700"
                  placeholder="Scan or type barcode"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button" 
                onClick={() => setShowProductModal(false)}
                className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={productSaving}
                className="flex-[2] py-4 bg-accent text-white font-black rounded-2xl hover:shadow-xl hover:shadow-accent/20 active:scale-95 disabled:opacity-50 transition-all"
              >
                {productSaving ? 'Saving...' : 'Save Product to Inventory'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default StockEntry;
