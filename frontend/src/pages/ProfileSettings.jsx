import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../utils/api';

// ✅ Defined OUTSIDE ProfileSettings so it's never recreated on re-render
const Field = ({ label, field, placeholder, hint, value, onChange, disabled }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-black uppercase tracking-widest text-gray-400">
      {label}
      {hint && <span className="text-blue-400 normal-case font-medium tracking-normal ml-1">{hint}</span>}
    </label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(field, e.target.value)}
      placeholder={placeholder}
      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold text-gray-900 transition-all placeholder:text-gray-300 placeholder:font-normal disabled:opacity-50"
      disabled={disabled}
    />
  </div>
);

const ProfileSettings = () => {
  const [form, setForm] = useState({
    name: '', shopName: '', shopAddress: '', shopPhone: '', shopGst: '', upiId: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const userRole = userInfo.role || 'Admin';

  const getConfig = () => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    return { headers: { Authorization: `Bearer ${userInfo.token}` } };
  };

  // Stable onChange handler — updates only the changed field
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await axios.get(`${API}/auth/profile`, getConfig());
        setForm({
          name: data.name || '',
          shopName: data.shopName || '',
          shopAddress: data.shopAddress || '',
          shopPhone: data.shopPhone || '',
          shopGst: data.shopGst || '',
          upiId: data.upiId || ''
        });
      } catch (e) {
        setError('Failed to load profile. Please check if the server is running.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const { data } = await axios.put(
        `${API}/auth/profile`,
        {
          name: form.name,
          shopName: form.shopName,
          shopAddress: form.shopAddress,
          shopPhone: form.shopPhone,
          shopGst: form.shopGst,
          upiId: form.upiId
        },
        getConfig()
      );

      const userInfo = JSON.parse(localStorage.getItem('userInfo'));
      localStorage.setItem('userInfo', JSON.stringify({
        ...userInfo,
        name: data.name,
        shopName: data.shopName || '',
        shopAddress: data.shopAddress || '',
        shopPhone: data.shopPhone || '',
        shopGst: data.shopGst || '',
        upiId: data.upiId || ''
      }));

      setForm({
        name: data.name || '',
        shopName: data.shopName || '',
        shopAddress: data.shopAddress || '',
        shopPhone: data.shopPhone || '',
        shopGst: data.shopGst || '',
        upiId: data.upiId || ''
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error('Profile save error:', err);
      setError(err.response?.data?.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[50vh] gap-4">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 text-sm font-medium">Loading your profile...</p>
    </div>
  );

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Shop Profile</h1>
        <p className="text-gray-500 font-medium mt-1">
          Your shop details will appear on all generated invoices & PDF receipts
        </p>
      </div>

      {/* Live Preview Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-2xl shadow-slate-800/40">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black tracking-tight truncate">
              {form.shopName || <span className="text-slate-500">Your Shop Name</span>}
            </h2>
            <p className="text-slate-400 text-sm mt-1 font-medium">
              {form.shopAddress || <span className="text-slate-600">Shop Address, City</span>}
            </p>
            {form.shopPhone && <p className="text-slate-400 text-sm font-medium">📞 {form.shopPhone}</p>}
            {form.shopGst && <p className="text-slate-400 text-sm font-medium">🧾 GST: {form.shopGst}</p>}
          </div>
          <div className="text-right ml-4 flex-shrink-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">INVOICE</div>
            <div className="text-lg font-black text-white">INV-2026-0001</div>
            <div className="text-xs text-slate-500 mt-1">Preview Only</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-xs text-slate-500 font-medium">✨ Live preview — changes reflect as you type</p>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-gray-200/50 p-8 space-y-6">

        <div>
          <h3 className="font-black text-gray-800 text-lg mb-5 flex items-center gap-2">👤 Account Details</h3>
          <Field
            label="Your Full Name" field="name"
            placeholder="e.g. Vinod Kumar" hint="— shown on login screen"
            value={form.name} onChange={handleChange} disabled={userRole === 'Staff'}
          />
        </div>

        <div className="border-t border-gray-100 pt-6 space-y-5">
          <h3 className="font-black text-gray-800 text-lg flex items-center gap-2">🏪 Shop / Business Details</h3>
          <Field
            label="Shop / Business Name" field="shopName"
            placeholder="e.g. VK General Store" hint="— appears on invoices"
            value={form.shopName} onChange={handleChange} disabled={userRole === 'Staff'}
          />
          <Field
            label="Shop Address" field="shopAddress"
            placeholder="e.g. 12, Main Road, New Delhi - 110001" hint="— appears on invoices"
            value={form.shopAddress} onChange={handleChange} disabled={userRole === 'Staff'}
          />
          <div className="grid grid-cols-2 gap-5">
            <Field
              label="Shop Phone" field="shopPhone"
              placeholder="e.g. 9876543210" hint="— on invoices"
              value={form.shopPhone} onChange={handleChange} disabled={userRole === 'Staff'}
            />
            <Field
              label="GST Number" field="shopGst"
              placeholder="e.g. 22AAAAA0000A1Z5" hint="— on invoices"
              value={form.shopGst} onChange={handleChange} disabled={userRole === 'Staff'}
            />
          </div>
          <Field
            label="UPI ID (for payments)" field="upiId"
            placeholder="e.g. shopname@okicici" hint="— for QR code generation"
            value={form.upiId} onChange={handleChange} disabled={userRole === 'Staff'}
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 font-bold text-sm flex items-center gap-2">
            ❌ {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 font-bold text-sm flex items-center gap-2">
            ✅ Profile saved successfully! Your invoices will now show your shop details.
          </div>
        )}

        {userRole === 'Admin' && (
          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : '💾 Save Profile'}
          </button>
        )}
      </form>
    </div>
  );
};
export default ProfileSettings;
