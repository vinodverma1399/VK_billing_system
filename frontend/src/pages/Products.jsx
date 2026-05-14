import { useState, useEffect } from 'react';
import axios from 'axios';
import { exportProductsCSV } from '../utils/csvExport';
import { API } from '../utils/api';

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
      <div className="flex justify-between items-center px-8 py-6 bg-gray-50/50 border-b">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-transform hover:rotate-90">&times;</button>
      </div>
      <div className="p-8">
        {children}
      </div>
    </div>
  </div>
);

const Products = () => {
  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editProduct, setEditProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'pending'
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [form, setForm] = useState({ name: '', category: '', unit: 'Piece', price: '', gst: '0', barcode: '', stock: '0', costPrice: '0', lowStockThreshold: '5' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState(null);

  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const userRole = userInfo.role || 'Admin';

  const getConfig = () => ({ headers: { Authorization: `Bearer ${userInfo.token}` } });

  useEffect(() => { 
    fetchProducts(); 
    fetchCategories();
  }, []);

  async function fetchProducts() {
    try {
      const { data } = await axios.get(`${API}/products`, getConfig());
      setProducts(data);
    } catch (err) {
      console.error('Error fetching products', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const { data } = await axios.get(`${API}/categories`, getConfig());
      setDbCategories(data);
    } catch (err) {
      console.error('Error fetching categories', err);
    }
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const { data } = await axios.post(`${API}/categories`, { name: newCategoryName }, getConfig());
      setDbCategories([...dbCategories, data]);
      setNewCategoryName('');
      if (form.category === '') setForm({ ...form, category: data.name });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await axios.delete(`${API}/categories/${id}`, getConfig());
      setDbCategories(dbCategories.filter(c => c._id !== id));
    } catch (err) {
      alert('Failed to delete category');
    }
  };

  const openAdd = () => {
    setEditProduct(null);
    setForm({ name: '', category: dbCategories.length > 0 ? dbCategories[0].name : '', unit: 'Piece', price: '', gst: '0', barcode: '', stock: '0', costPrice: '0', lowStockThreshold: '5' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setForm({ name: p.name, category: p.category || (dbCategories.length > 0 ? dbCategories[0].name : ''), unit: p.unit || 'Piece', price: p.price, gst: p.gst, barcode: p.barcode || '', stock: p.stock, costPrice: p.costPrice || '0', lowStockThreshold: p.lowStockThreshold ?? 5 });
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`${API}/products/${id}`, getConfig());
      setProducts(products.filter(p => p._id !== id));
    } catch (err) {
      alert('Failed to delete product');
    }
  };

  const handleApprove = async (id) => {
    setApprovingId(id);
    try {
      const { data } = await axios.put(`${API}/products/${id}/approve`, {}, getConfig());
      setProducts(products.map(p => p._id === id ? data : p));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve');
    } finally {
      setApprovingId(null);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price) return setError('Name and Price are required');
    if (!form.category) return setError('Please select a Category. Create one if none exist.');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        unit: form.unit,
        price: Number(form.price),
        gst: Number(form.gst) || 0,
        barcode: form.barcode,
        stock: Number(form.stock) || 0,
        costPrice: Number(form.costPrice) || 0,
        lowStockThreshold: Number(form.lowStockThreshold) ?? 5
      };
      if (editProduct) {
        const { data } = await axios.put(`${API}/products/${editProduct._id}`, payload, getConfig());
        setProducts(products.map(p => p._id === data._id ? data : p));
      } else {
        const { data } = await axios.post(`${API}/products`, payload, getConfig());
        setProducts([data, ...products]);
      }
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const activeProducts = products.filter(p => p.status === 'active' &&
    (categoryFilter === 'All' || p.category === categoryFilter) &&
    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const pendingProducts = products.filter(p => p.status === 'pending' &&
    (categoryFilter === 'All' || p.category === categoryFilter) &&
    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const pendingCount = products.filter(p => p.status === 'pending').length;
  const displayProducts = activeTab === 'pending' ? pendingProducts : activeProducts;

  const categories = ['All', ...new Set(products.map(p => p.category))].filter(Boolean);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Inventory</h1>
          <p className="text-gray-500 font-medium">Manage your products and stock levels</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-5 py-3 bg-purple-50 text-purple-700 rounded-2xl font-bold hover:bg-purple-100 transition text-sm border border-purple-200"
          >
            🏷️ Manage Categories
          </button>
          <button onClick={() => exportProductsCSV(products)} className="px-5 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition text-sm">
            ⬇️ Export CSV
          </button>
          <button
            onClick={openAdd}
            className="bg-accent text-white px-6 py-3 rounded-2xl font-bold hover:shadow-xl hover:shadow-accent/20 transition-all active:scale-95"
          >
            {userRole === 'Staff' ? '+ Request New Product' : '+ Create Product'}
          </button>
        </div>
      </div>

      {/* Tabs — pending tab visible only to Admin (or Staff to see their own requests) */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${activeTab === 'active' ? 'bg-gray-900 text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
        >
          ✅ Active Products
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'pending' ? 'bg-amber-500 text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
        >
          ⏳ Pending Approval
          {pendingCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{pendingCount}</span>
          )}
        </button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by name or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none transition-all font-medium"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl grayscale opacity-50">🔍</span>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-accent/10 focus:border-accent outline-none transition-all font-bold text-gray-700 w-48"
        >
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Pending hint for Staff */}
      {activeTab === 'active' && userRole === 'Staff' && pendingCount > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm font-bold">
          ⏳ {pendingCount} product{pendingCount > 1 ? 's' : ''} waiting for Admin approval
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b">
              <tr>
                <th className="px-8 py-5">Product Details</th>
                <th className="px-8 py-5">Category</th>
                <th className="px-8 py-5">Barcode</th>
                <th className="px-8 py-5">Price & Tax</th>
                <th className="px-8 py-5">Stock</th>
                {activeTab === 'pending' && <th className="px-8 py-5">Requested By</th>}
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-20 text-gray-400 font-bold">Loading your inventory...</td></tr>
              ) : displayProducts.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-20 text-gray-400">
                  <div className="text-4xl mb-2">{activeTab === 'pending' ? '⏳' : '📦'}</div>
                  <div className="font-bold">{activeTab === 'pending' ? 'No pending approvals' : 'No products found'}</div>
                </td></tr>
              ) : (
                displayProducts.map((p) => (
                  <tr key={p._id} className={`hover:bg-gray-50/50 transition-colors group ${p.status === 'pending' ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-8 py-6">
                      <div className="font-bold text-gray-900 text-base">{p.name}</div>
                      <div className="text-xs text-gray-400 font-medium uppercase flex items-center gap-1">
                        Retail Item
                        {p.status === 'pending' && (
                          <span className="ml-1 bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md text-[9px] font-black">⏳ PENDING</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {p.category || 'No Category'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-mono text-xs font-bold border border-gray-200">
                        {p.barcode || 'NO BARCODE'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-gray-900 text-base">₹{p.price.toLocaleString()}</div>
                      <div className="text-xs text-success font-bold">+{p.gst}% GST</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${p.stock > 10 ? 'bg-success' : p.stock > 0 ? 'bg-yellow-400' : 'bg-red-500'}`}></div>
                        <span className={`text-sm font-black ${p.stock > 10 ? 'text-success' : p.stock > 0 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {p.stock} {p.unit || 'Piece'}
                        </span>
                      </div>
                    </td>
                    {activeTab === 'pending' && (
                      <td className="px-8 py-6">
                        <div className="font-bold text-gray-900">{p.createdBy?.name || 'Staff'}</div>
                        <div className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('en-IN')}</div>
                      </td>
                    )}
                    <td className="px-8 py-6 sticky right-0 bg-white lg:bg-transparent shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.05)] lg:shadow-none">
                      {p.status === 'pending' && userRole === 'Admin' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleApprove(p._id)}
                            disabled={approvingId === p._id}
                            className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all"
                          >
                            {approvingId === p._id ? '...' : '✅ Approve'}
                          </button>
                          <button onClick={() => openEdit(p)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition" title="Edit before approving">✏️</button>
                          <button onClick={() => handleDelete(p._id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition" title="Delete">🗑️</button>
                        </div>
                      ) : p.status === 'pending' && userRole === 'Staff' ? (
                        <span className="text-[10px] text-amber-500 font-bold italic">Awaiting approval</span>
                      ) : userRole === 'Admin' ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEdit(p)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition">✏️</button>
                          <button onClick={() => handleDelete(p._id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition">🗑️</button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-300 italic">View only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editProduct ? 'Update Product' : userRole === 'Staff' ? '📋 Request New Product' : 'New Product'} onClose={() => setShowModal(false)}>
          {userRole === 'Staff' && !editProduct && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm font-bold">
              ⏳ This product will be sent for <b>Admin approval</b> before it goes live in inventory.
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-6">
            {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100">{error}</div>}

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Product Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold"
                  placeholder="Product title..."
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Category *</label>
                <div className="flex gap-2">
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="flex-1 px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold text-gray-700"
                    required
                  >
                    {dbCategories.length === 0 ? (
                       <option value="">No Categories Found</option>
                    ) : (
                      <>
                        <option value="" disabled>Select a Category...</option>
                        {dbCategories.map(c => (
                          <option key={c._id} value={c.name}>{c.name}</option>
                        ))}
                      </>
                    )}
                  </select>
                  <button type="button" onClick={() => setShowCategoryModal(true)} className="px-4 bg-purple-50 text-purple-600 rounded-2xl font-bold hover:bg-purple-100 border border-purple-200" title="Manage Categories">
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Unit of Measurement *</label>
              <select
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold text-gray-700"
                required
              >
                {['Piece', 'Meter', 'Liter', 'Kg', 'ML', 'Gm', 'Number', 'Pack', 'Box', 'Dozen'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Price (₹)</label>
                <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold"
                  placeholder="0.00" required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">GST (%)</label>
                <input type="number" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold"
                  placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Barcode</label>
                <input type="text" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-mono font-bold"
                  placeholder="Scan code..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Opening Stock</label>
                <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-bold"
                  placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Cost Price (₹) <span className="text-orange-400">— for profit calc</span></label>
                <input type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-400 transition-all outline-none font-bold"
                  placeholder="Purchase cost per unit" min="0" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Low Stock Alert <span className="text-red-400">— auto warning</span></label>
                <input type="number" value={form.lowStockThreshold} onChange={e => setForm({ ...form, lowStockThreshold: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-red-400 transition-all outline-none font-bold"
                  placeholder="Alert when stock ≤" min="0" />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-[2] py-4 bg-accent text-white rounded-2xl font-black shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 active:scale-95 transition-all disabled:opacity-50">
                {saving ? 'Processing...' : editProduct ? 'Update Product' : userRole === 'Staff' ? '📋 Submit for Approval' : 'Create Product'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showCategoryModal && (
        <Modal title="🏷️ Manage Categories" onClose={() => setShowCategoryModal(false)}>
          <form onSubmit={handleCreateCategory} className="mb-6 flex gap-3">
            <input
              type="text"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              className="flex-1 px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all outline-none font-bold"
              placeholder="New Category Name..."
              required
            />
            <button type="submit" className="px-6 py-3 bg-purple-600 text-white rounded-2xl font-black shadow-lg shadow-purple-600/20 hover:bg-purple-700 active:scale-95 transition-all">
              Add
            </button>
          </form>

          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            {dbCategories.length === 0 ? (
              <div className="p-6 text-center text-gray-400 font-bold">No categories added yet.</div>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {dbCategories.map(c => (
                  <li key={c._id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                    <span className="font-bold text-gray-800">{c.name}</span>
                    <button 
                      onClick={() => handleDeleteCategory(c._id)} 
                      className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition"
                      title="Delete Category"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Products;
