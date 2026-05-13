import { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generatePLReport } from '../utils/pdfGenerator';
import { exportGstReportCSV, exportSalesReportCSV, exportVendorPurchasesCSV, exportInvoiceStatusCSV } from '../utils/csvExport';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('sales'); // sales, vendor, invoice
  const [salesType, setSalesType] = useState('monthly'); // daily, monthly
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salesData, setSalesData] = useState([]);
  const [vendorData, setVendorData] = useState([]);
  const [invoiceStatusData, setInvoiceStatusData] = useState({ summary: {}, details: [] });
  const [gstData, setGstData] = useState([]);
  const [plData, setPlData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [activeTab, salesType, startDate, endDate]);

  async function fetchReportData() {
    setLoading(true);
    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };

      // Convert local dates to exact ISO strings covering the full local day
      let queryStart = '';
      let queryEnd = '';
      if (startDate) {
        const d = new Date(startDate);
        d.setHours(0, 0, 0, 0);
        queryStart = d.toISOString();
      }
      if (endDate) {
        const d = new Date(endDate);
        d.setHours(23, 59, 59, 999);
        queryEnd = d.toISOString();
      }

      const buildUrl = (path) => {
        let url = `http://localhost:5000/api/reports/${path}`;
        url += url.includes('?') ? '&' : '?';
        if (queryStart) url += `startDate=${queryStart}&`;
        if (queryEnd) url += `endDate=${queryEnd}`;
        return url.endsWith('&') ? url.slice(0, -1) : url;
      };

      if (activeTab === 'sales') {
        const { data } = await axios.get(buildUrl(`sales?type=${salesType}`), config);
        setSalesData(data);
      } else if (activeTab === 'vendor') {
        const { data } = await axios.get(buildUrl('vendor-purchases'), config);
        setVendorData(data);
      } else if (activeTab === 'invoice') {
        const { data } = await axios.get(buildUrl('invoice-status'), config);
        setInvoiceStatusData(data);
      } else if (activeTab === 'gst') {
        const { data } = await axios.get(buildUrl('gst'), config);
        setGstData(data);
      } else if (activeTab === 'pl') {
        const { data } = await axios.get(buildUrl('pl'), config);
        setPlData(data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    }
    setLoading(false);
  };

  const exportSalesPDF = () => {
    const doc = new jsPDF();
    doc.text(`Sales Report (${salesType.toUpperCase()})`, 14, 15);
    
    const tableColumn = ["Period", "Revenue", "GST Collected", "Paid", "Unpaid", "Invoices Count"];
    const tableRows = salesData.map(item => {
      let period = '';
      if (salesType === 'daily') {
        period = `${item._id.day}/${item._id.month}/${item._id.year}`;
      } else {
        period = `${item._id.month}/${item._id.year}`;
      }
      return [
        period,
        `Rs ${item.totalRevenue.toLocaleString()}`,
        `Rs ${item.totalGst?.toLocaleString() || 0}`,
        `Rs ${item.paidAmount.toLocaleString()}`,
        `Rs ${item.unpaidAmount.toLocaleString()}`,
        item.totalInvoices
      ];
    });

    autoTable(doc, {
      startY: 20,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid'
    });
    doc.save(`Sales_Report_${salesType}.pdf`);
  };

  const exportVendorPDF = () => {
    const doc = new jsPDF();
    doc.text(`Vendor Purchases Report`, 14, 15);
    
    const tableColumn = ["Vendor Name", "Mobile", "Total Purchases", "Orders Count"];
    const tableRows = vendorData.map(item => [
      item.vendorName,
      item.vendorMobile || 'N/A',
      `Rs ${item.totalPurchases.toLocaleString()}`,
      item.purchaseCount
    ]);

    autoTable(doc, { startY: 20, head: [tableColumn], body: tableRows, theme: 'grid' });
    doc.save(`Vendor_Report.pdf`);
  };

  const exportInvoicePDF = () => {
    const doc = new jsPDF();
    doc.text(`Bill Paid/Unpaid Report`, 14, 15);
    
    const tableColumn = ["Date", "Type", "Client Name", "Amount", "Status"];
    const tableRows = invoiceStatusData.details.map(item => [
      new Date(item.date).toLocaleDateString(),
      item.type,
      item.clientName,
      `Rs ${item.amount.toLocaleString()}`,
      item.status
    ]);

    autoTable(doc, { startY: 20, head: [tableColumn], body: tableRows, theme: 'grid' });
    doc.save(`Invoice_Status_Report.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Reports & Analytics</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">Filter by date range across all report types</p>
        </div>

      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          className={`py-2 px-4 font-semibold ${activeTab === 'sales' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('sales')}
        >
          Sales Report
        </button>
        <button
          className={`py-2 px-4 font-semibold ${activeTab === 'vendor' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('vendor')}
        >
          Vendor Purchases
        </button>
        <button
          className={`py-2 px-4 font-semibold ${activeTab === 'invoice' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('invoice')}
        >
          All Bills (Sales & Purchases)
        </button>
        <button
          className={`py-2 px-4 font-semibold ${activeTab === 'gst' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('gst')}
        >
          GST Export (GSTR-1)
        </button>
        <button
          className={`py-2 px-4 font-semibold ${activeTab === 'pl' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('pl')}
        >
          Profit & Loss
        </button>
      </div>

      {/* Global Date Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center justify-between border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">From Date:</span>
            <input 
              type="date" 
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">To Date:</span>
            <input 
              type="date" 
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-md p-6">
        {loading ? (
          <p className="text-center py-10 text-gray-500">Loading Report Data...</p>
        ) : (
          <>
            {/* Sales Tab */}
            {activeTab === 'sales' && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div className="flex space-x-4 items-center">
                    <select
                      className="border rounded-lg px-4 py-2 bg-gray-50 focus:ring focus:ring-blue-200 font-bold"
                      value={salesType}
                      onChange={(e) => setSalesType(e.target.value)}
                    >
                      <option value="monthly">Monthly Aggregation</option>
                      <option value="daily">Daily Aggregation</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => exportSalesReportCSV(salesData, salesType)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                      Export CSV
                    </button>
                    <button onClick={exportSalesPDF} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                      Export PDF
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 text-sm uppercase">
                        <th className="p-3 border-b">Period</th>
                        <th className="p-3 border-b">Total Revenue</th>
                        <th className="p-3 border-b text-orange-600">GST Collected</th>
                        <th className="p-3 border-b text-green-600">Paid Total</th>
                        <th className="p-3 border-b text-red-600">Unpaid Total</th>
                        <th className="p-3 border-b">Invoices Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.length === 0 ? <tr><td colSpan="6" className="p-4 text-center">No data available</td></tr> : null}
                      {salesData.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-bold">
                            {salesType === 'daily' 
                              ? `${item._id.day}/${item._id.month}/${item._id.year}` 
                              : `${item._id.month}/${item._id.year}`}
                          </td>
                          <td className="p-3 font-black text-gray-800">Rs {item.totalRevenue.toLocaleString()}</td>
                          <td className="p-3 font-bold text-orange-600">Rs {item.totalGst?.toLocaleString() || 0}</td>
                          <td className="p-3 font-bold text-green-600">Rs {item.paidAmount.toLocaleString()}</td>
                          <td className="p-3 font-bold text-red-500">Rs {item.unpaidAmount.toLocaleString()}</td>
                          <td className="p-3 font-bold">{item.totalInvoices}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Vendor Tab */}
            {activeTab === 'vendor' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-700">Total Purchase Volume by Vendor</h2>
                  <div className="flex gap-2">
                    <button onClick={() => exportVendorPurchasesCSV(vendorData)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                      Export CSV
                    </button>
                    <button onClick={exportVendorPDF} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                      Export PDF
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 text-sm uppercase">
                        <th className="p-3 border-b">Vendor Name</th>
                        <th className="p-3 border-b">Mobile</th>
                        <th className="p-3 border-b">Total Purchased Amount</th>
                        <th className="p-3 border-b">Number of Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorData.length === 0 ? <tr><td colSpan="4" className="p-4 text-center">No purchases recorded yet</td></tr> : null}
                      {vendorData.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-semibold">{item.vendorName}</td>
                          <td className="p-3">{item.vendorMobile || 'N/A'}</td>
                          <td className="p-3 font-bold text-blue-600">Rs {item.totalPurchases.toLocaleString()}</td>
                          <td className="p-3">{item.purchaseCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Invoice Status Tab */}
            {activeTab === 'invoice' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-green-700">Sales Received</p>
                      <p className="text-xl font-black text-green-800">Rs {invoiceStatusData.summary.totalSalesPaid?.toLocaleString() || 0}</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-700">Sales Pending</p>
                      <p className="text-xl font-black text-red-800">Rs {invoiceStatusData.summary.totalSalesUnpaid?.toLocaleString() || 0}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Purchases Paid</p>
                      <p className="text-xl font-black text-blue-800">Rs {invoiceStatusData.summary.totalPurchasesPaid?.toLocaleString() || 0}</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl">
                      <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">Purchases Due</p>
                      <p className="text-xl font-black text-orange-800">Rs {invoiceStatusData.summary.totalPurchasesPending?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => exportInvoiceStatusCSV(invoiceStatusData.details)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                      Export CSV
                    </button>
                    <button onClick={exportInvoicePDF} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                      Export PDF
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 text-sm uppercase">
                        <th className="p-3 border-b">Date</th>
                        <th className="p-3 border-b">Type</th>
                        <th className="p-3 border-b">Client / Vendor Name</th>
                        <th className="p-3 border-b">Amount</th>
                        <th className="p-3 border-b">Status</th>
                        <th className="p-3 border-b text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceStatusData.details.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{new Date(item.date).toLocaleDateString()}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              item.type === 'Sale' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="p-3 font-bold">{item.clientName}</td>
                          <td className="p-3 font-black text-gray-800">Rs {item.amount.toLocaleString()}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              item.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {item.type === 'Sale' ? (
                              <a href="/invoices" className="text-blue-600 hover:text-blue-800 font-bold text-sm underline">Update Invoice</a>
                            ) : (
                              <a href="/purchases" className="text-blue-600 hover:text-blue-800 font-bold text-sm underline">Update Stock Entry</a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Profit & Loss Tab */}
            {activeTab === 'pl' && plData && (
              <div className="space-y-8 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 relative overflow-hidden">
                    <div className="relative z-10">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">Gross Profit</p>
                      <h2 className="text-4xl font-black text-emerald-800">₹{plData.grossProfit.toLocaleString()}</h2>
                      <p className="text-xs font-bold text-emerald-600 mt-2">Margin: {plData.grossMargin}%</p>
                    </div>
                    <div className="absolute top-[-20%] right-[-10%] text-9xl opacity-5">💰</div>
                  </div>
                  <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 relative overflow-hidden">
                    <div className="relative z-10">
                      <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Net Profit</p>
                      <h2 className="text-4xl font-black text-blue-800">₹{plData.netProfit.toLocaleString()}</h2>
                      <p className="text-xs font-bold text-blue-600 mt-2">Margin: {plData.netMargin}%</p>
                    </div>
                    <div className="absolute top-[-20%] right-[-10%] text-9xl opacity-5">📈</div>
                  </div>
                  <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 relative overflow-hidden">
                    <div className="relative z-10">
                      <p className="text-xs font-black text-rose-600 uppercase tracking-widest mb-1">Total Expenses</p>
                      <h2 className="text-4xl font-black text-rose-800">₹{plData.totalExpenses.toLocaleString()}</h2>
                      <p className="text-xs font-bold text-rose-600 mt-2">{plData.expenseCount} entries</p>
                    </div>
                    <div className="absolute top-[-20%] right-[-10%] text-9xl opacity-5">💸</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Revenue Breakdown</h3>
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 font-bold">Total Sales (Inclusive)</span>
                          <span className="font-black text-gray-900">₹{plData.totalRevenue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 font-bold">GST Collected</span>
                          <span className="font-black text-orange-600">- ₹{plData.totalGst.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 font-bold">Product Discounts</span>
                          <span className="font-black text-gray-400">₹{plData.totalDiscount.toLocaleString()}</span>
                        </div>
                        <div className="pt-3 border-t border-dashed flex justify-between items-center">
                          <span className="text-gray-900 font-black">Net Revenue (Tax Excl.)</span>
                          <span className="font-black text-gray-900">₹{plData.revenueExGst.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-black text-gray-900 tracking-tight mt-6">Cost Breakdown</h3>
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 font-bold">Cost of Goods (Purchases)</span>
                          <span className="font-black text-gray-900">₹{plData.totalCOGS.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 font-bold">Returns & Refunds</span>
                          <span className="font-black text-rose-600">₹{plData.totalRefunds.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Expense Categories</h3>
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                      <div className="p-4 space-y-4">
                        {Object.entries(plData.expenseByCategory).length === 0 ? (
                          <p className="text-center py-4 text-gray-400 font-bold">No expenses recorded</p>
                        ) : (
                          Object.entries(plData.expenseByCategory).map(([cat, amt]) => (
                            <div key={cat} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-black">
                                <span className="text-gray-500 uppercase tracking-widest">{cat}</span>
                                <span className="text-gray-900 font-black">₹{amt.toLocaleString()}</span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-rose-500 rounded-full" 
                                  style={{ width: `${(amt / plData.totalExpenses) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => generatePLReport(plData, new Date().getMonth(), new Date().getFullYear())}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black hover:bg-black transition-all shadow-xl shadow-gray-900/10 flex items-center justify-center gap-3"
                >
                  📥 Download Full P&L Statement (PDF)
                </button>
              </div>
            )}

            {/* GST Tab */}
            {activeTab === 'gst' && (
              <div className="space-y-6 text-center py-10">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
                  📊
                </div>
                <h2 className="text-2xl font-black text-gray-900">GST Monthly Filing Report</h2>
                <p className="text-gray-500 font-medium max-w-lg mx-auto">
                  Download a detailed, invoice-level GSTR-1 format CSV file. It automatically splits your sales into 0%, 5%, 12%, 18%, and 28% tax slabs.
                </p>
                <div className="pt-6">
                  <button 
                    onClick={() => exportGstReportCSV(gstData)} 
                    disabled={gstData.length === 0}
                    className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/20 transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-3 mx-auto"
                  >
                    <span>📥</span> {gstData.length === 0 ? 'No Data in Range' : 'Download GSTR-1 CSV'}
                  </button>
                  {gstData.length > 0 && (
                    <p className="text-xs font-bold text-gray-400 mt-4 uppercase tracking-widest">
                      Ready to export {gstData.length} invoices
                    </p>
                  )}
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
