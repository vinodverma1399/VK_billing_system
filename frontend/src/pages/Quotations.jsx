import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { printThermal } from '../utils/pdfGenerator';
import { API } from '../utils/api';

const Quotations = () => {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const navigate = useNavigate();

  const getConfig = () => ({ headers: { Authorization: `Bearer ${userInfo.token}` } });

  useEffect(() => { fetchQuotations(); }, []);

  async function fetchQuotations() {
    try {
      const { data } = await axios.get(`${API}/quotations`, getConfig());
      setQuotations(data);
    } catch (err) {
      console.error('Error fetching quotations', err);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quotation?')) return;
    try {
      await axios.delete(`${API}/quotations/${id}`, getConfig());
      setQuotations(quotations.filter(q => q._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleConvertToInvoice = (q) => {
    // Navigate to Create Invoice page, passing quotation data to pre-fill
    navigate('/invoices/new', { state: { quotationToConvert: q } });
  };

  const filteredQuotations = quotations.filter(q => {
    const searchLower = searchQuery.toLowerCase();
    const custNameMatch = q.customer?.name?.toLowerCase().includes(searchLower) || false;
    const invMatch = q.quotationNumber?.toLowerCase().includes(searchLower) || false;
    return custNameMatch || invMatch;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 mb-2">Quotations & Estimates</h1>
          <p className="text-gray-500 font-medium">Create kachha bills without deducting stock.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Link to="/create-quotation" className="px-6 py-3.5 bg-gray-900 text-white font-bold rounded-2xl shadow-lg hover:bg-gray-800 hover:shadow-xl hover:-translate-y-0.5 transition-all text-center">
            + New Quotation
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/50">
          <input
            type="text"
            placeholder="Search by ID or Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-md px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all outline-none font-medium shadow-sm"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b border-gray-100">
              <tr>
                <th className="px-6 py-5">Quotation Info</th>
                <th className="px-6 py-5">Customer</th>
                <th className="px-6 py-5 text-right">Amount</th>
                <th className="px-6 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="4" className="text-center py-20 text-gray-400 font-bold">Loading quotations...</td></tr>
              ) : filteredQuotations.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-20 text-gray-400 font-bold">No quotations found.</td></tr>
              ) : (
                filteredQuotations.map((q) => (
                  <tr key={q._id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="font-black text-gray-900">{q.quotationNumber}</div>
                      <div className="text-xs text-gray-400 font-medium">{new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-gray-900">{q.customer?.name || 'Walk-in'}</div>
                      <div className="text-xs text-gray-400">{q.customer?.mobile || '-'}</div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="font-black text-gray-900 text-lg">₹{q.finalAmount.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Kachha Bill</div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => printThermal(q, userInfo)} className="p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition" title="Print Estimate">🖨️</button>
                        <button onClick={() => handleConvertToInvoice(q)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition font-bold text-xs border border-blue-200 shadow-sm" title="Convert to Real Invoice">
                          Convert to Bill
                        </button>
                        {userInfo.role === 'Admin' && (
                          <button onClick={() => handleDelete(q._id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition" title="Delete">🗑️</button>
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
    </div>
  );
};

export default Quotations;
