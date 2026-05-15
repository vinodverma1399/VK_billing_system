import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import API_URL, { API } from '../utils/api';

// ── Helpers ────────────────────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const StatusBadge = ({ status }) => {
  const s = {
    Paid:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
    Unpaid:    'bg-rose-50 text-rose-600 border border-rose-200',
    Partial:   'bg-amber-50 text-amber-700 border border-amber-200',
    Cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
  };
  return (
    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${s[status] || s.Unpaid}`}>
      {status}
    </span>
  );
};

// ── Main Component ─────────────────────────────────────────────────────
const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeAlert, setActiveAlert] = useState('lowStock');
  const [bsRange, setBsRange] = useState('all'); // best sellers range
  const [bsFrom, setBsFrom] = useState('');
  const [bsTo, setBsTo] = useState('');
  const [bestSellers, setBestSellers] = useState([]);

  const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};
  const shopkeeperName = userInfo.name || 'Dashboard';

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
        const { data } = await axios.get(`${API}/dashboard/metrics`, config);
        console.log('Dashboard Metrics Received:', data);
        setMetrics(data);
      } catch (error) {
        console.error('Error fetching metrics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();

    const socket = io(API_URL);
    socket.on('new-invoice', (newInvoice) => {
      setMetrics((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          totalInvoices: prev.totalInvoices + 1,
          totalRevenue: prev.totalRevenue + newInvoice.finalAmount,
          todaySales: prev.todaySales + newInvoice.finalAmount,
          paidAmount: prev.paidAmount + (newInvoice.amountPaid || 0),
          unpaidAmount: prev.unpaidAmount + (newInvoice.finalAmount - (newInvoice.amountPaid || 0)),
          recentInvoices: [newInvoice, ...prev.recentInvoices].slice(0, 5)
        };
      });
    });
    return () => socket.disconnect();
  }, []);

  const fetchBestSellers = async (range, from, to) => {
    try {
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      let url = `${API}/dashboard/best-sellers?range=${range}`;
      if (range === 'custom' && from && to) url += `&from=${from}&to=${to}`;
      const { data } = await axios.get(url, config);
      setBestSellers(data.bestSellers || []);
    } catch (err) { console.error('Best sellers fetch failed', err); }
  };

  const handleBsRangeChange = (range) => {
    setBsRange(range);
    if (range !== 'custom') fetchBestSellers(range, '', '');
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[70vh] space-y-6">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-400 font-black tracking-[0.2em] uppercase text-xs animate-pulse">Loading Smart Dashboard...</p>
      </div>
    );
  }

  if (!metrics) return null;

  const m = metrics;
  const alertCount = (m.lowStockProducts?.length || 0) + (m.overdueList?.length || 0);
  // Best sellers: use filtered data if available, else from metrics
  const displayBestSellers = bestSellers.length > 0 ? bestSellers : (m.bestSellers || []);

  // ── Stat Cards ────────────────────────────────────────────────────────
  const statCards = [
    {
      title: "Today's Sales", value: fmt(m.todaySales),
      sub: m.salesGrowth > 0 ? `▲ ${m.salesGrowth}% vs yesterday` : m.salesGrowth < 0 ? `▼ ${Math.abs(m.salesGrowth)}% vs yesterday` : 'Same as yesterday',
      subColor: m.salesGrowth > 0 ? 'text-emerald-500' : m.salesGrowth < 0 ? 'text-red-400' : 'text-gray-400',
      icon: '📅', color: 'from-blue-600 to-blue-400', shadow: 'shadow-blue-500/30'
    },
    {
      title: 'Gross Revenue', value: fmt(m.totalRevenue),
      sub: 'All time sales',
      subColor: 'text-gray-400',
      icon: '💰', color: 'from-purple-600 to-purple-400', shadow: 'shadow-purple-500/30'
    },
    {
      title: 'Gross Profit', value: fmt(m.grossProfit),
      sub: `${m.profitMargin}% margin`,
      subColor: m.grossProfit >= 0 ? 'text-emerald-500' : 'text-red-400',
      icon: '📈', color: m.grossProfit >= 0 ? 'from-emerald-600 to-teal-400' : 'from-red-500 to-rose-400',
      shadow: m.grossProfit >= 0 ? 'shadow-emerald-500/30' : 'shadow-red-500/30'
    },
    {
      title: 'GST Collected', value: fmt(m.totalGst),
      sub: `Today: ${fmt(m.todayGst)}`,
      subColor: 'text-orange-400',
      icon: '🧾', color: 'from-orange-500 to-amber-400', shadow: 'shadow-orange-500/30'
    },
    {
      title: 'Paid Receipts', value: fmt(m.paidAmount),
      sub: `Pending: ${fmt(m.unpaidAmount)}`,
      subColor: 'text-red-400',
      icon: '✅', color: 'from-indigo-600 to-indigo-400', shadow: 'shadow-indigo-500/30'
    },
    {
      title: 'Active Customers', value: m.totalCustomers,
      sub: `${m.totalProducts} products`,
      subColor: 'text-gray-400',
      icon: '💎', color: 'from-rose-500 to-pink-400', shadow: 'shadow-rose-500/30'
    },
  ];

  // ── Alert tabs ──────────────────────────────────────────────────────
  const alertTabs = [
    { key: 'lowStock', label: '🔴 Low Stock', count: m.lowStockProducts?.length, data: m.lowStockProducts },
    { key: 'overdue',  label: '⏰ Overdue Bills', count: m.overdueList?.length, data: m.overdueList },
    { key: 'customers', label: '👥 Customer Dues', count: m.customerOutstanding?.length, data: m.customerOutstanding },
    { key: 'vendors',  label: '🏪 Vendor Dues', count: m.vendorPending?.length, data: m.vendorPending },
    ...((userInfo.role === 'Admin' || !userInfo.role) ? [{ key: 'staffSales', label: '👤 Staff Sales', count: m.staffTodaySales?.length, data: m.staffTodaySales }] : []),
  ];

  return (
    <div className="space-y-10">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 premium-glass p-10 rounded-[2.5rem] relative overflow-hidden group">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-black uppercase tracking-widest mb-4 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            Smart Dashboard — Live
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter mb-2 uppercase text-gradient leading-tight py-2 break-words">{shopkeeperName}</h1>
          <p className="text-gray-500 font-medium text-lg">Real-time analytics · Auto-alerts · Smart insights</p>
        </div>
        <div className="flex gap-3 relative z-10">
          {alertCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-2xl text-red-600 font-black text-sm animate-pulse">
              ⚠️ {alertCount} Alert{alertCount > 1 ? 's' : ''} Active
            </div>
          )}
          <Link
            to="/invoices/new"
            className="relative group overflow-hidden bg-gray-900 text-white px-8 py-4 rounded-2xl font-black shadow-2xl hover:shadow-gray-900/40 active:scale-95 transition-all"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="relative flex items-center gap-2">🚀 New Invoice</span>
          </Link>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-white/70 backdrop-blur-xl p-7 rounded-[2rem] border border-white hover:border-blue-100 shadow-lg shadow-gray-100/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative">
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`w-13 h-13 w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.color} text-white text-2xl flex items-center justify-center shadow-lg ${stat.shadow} group-hover:scale-110 transition-transform duration-300`}>
                {stat.icon}
              </div>
              <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-gray-200">Auto</span>
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{stat.title}</p>
              <h3 className="text-3xl font-black text-gray-900 tracking-tighter mb-1">{stat.value}</h3>
              <p className={`text-xs font-bold ${stat.subColor}`}>{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Smart Alert Panel ───────────────────────────────────── */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-white overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              🤖 Automatic Alerts & Insights
            </h2>
            <p className="text-gray-400 text-sm font-medium">Auto-updated in real time</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveAlert(tab.key)}
                className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                  activeAlert === tab.key
                    ? 'bg-gray-900 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] ${activeAlert === tab.key ? 'bg-white text-gray-900' : 'bg-red-500 text-white'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-8">
          {/* 🔴 Low Stock */}
          {activeAlert === 'lowStock' && (
            <div>
              {m.lowStockProducts?.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <div className="text-4xl mb-2">✅</div>
                  <div className="font-bold">All products have sufficient stock!</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                    {m.lowStockProducts.length} product(s) need restocking
                  </p>
                  {m.lowStockProducts.map((p, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border ${p.stock === 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{p.stock === 0 ? '🚫' : '⚠️'}</span>
                        <div>
                          <div className="font-black text-gray-900">{p.name}</div>
                          <div className={`text-xs font-bold ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                            {p.stock === 0 ? 'OUT OF STOCK' : `Only ${p.stock} left`} · Alert level: {p.threshold}
                          </div>
                        </div>
                      </div>
                      <Link to="/purchases" className="text-xs font-black text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 hover:bg-blue-100 transition">
                        Restock →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ⏰ Overdue Bills */}
          {activeAlert === 'overdue' && (
            <div>
              {m.overdueList?.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <div className="text-4xl mb-2">🎉</div>
                  <div className="font-bold">No overdue bills! All caught up.</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <p className="text-xs font-black text-red-500 uppercase tracking-widest mb-4">
                    ⚠️ {m.overdueList.length} unpaid bill(s) older than 7 days
                  </p>
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] uppercase font-black text-gray-400 tracking-widest border-b">
                      <tr>
                        <th className="pb-3 pr-6">Customer</th>
                        <th className="pb-3 pr-6">Amount</th>
                        <th className="pb-3 pr-6">Status</th>
                        <th className="pb-3 pr-6">Overdue By</th>
                        <th className="pb-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {m.overdueList.map((inv, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="py-3 pr-6">
                            <div className="font-black text-gray-900">{inv.customerName}</div>
                            <div className="text-xs text-gray-400">{inv.customerMobile}</div>
                          </td>
                          <td className="py-3 pr-6 font-black text-gray-900">{fmt(inv.amount)}</td>
                          <td className="py-3 pr-6"><StatusBadge status={inv.status} /></td>
                          <td className="py-3 pr-6">
                            <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                              {inv.daysOverdue} days
                            </span>
                          </td>
                          <td className="py-3">
                            <Link to={`/invoices/${inv._id}/edit`} className="text-xs font-black text-blue-600 hover:underline">
                              Update →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 👥 Customer Outstanding */}
          {activeAlert === 'customers' && (
            <div>
              {m.customerOutstanding?.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <div className="text-4xl mb-2">💚</div>
                  <div className="font-bold">No outstanding customer balances!</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                    Top customers with pending payments
                  </p>
                  {m.customerOutstanding.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-200 text-rose-700 flex items-center justify-center font-black text-lg">
                          {c.name[0]}
                        </div>
                        <div>
                          <div className="font-black text-gray-900">{c.name}</div>
                          <div className="text-xs text-gray-500">{c.mobile} · {c.invoiceCount} invoice(s)</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-rose-600 text-lg">{fmt(c.outstanding)}</div>
                        <div className="text-[10px] text-gray-400 uppercase font-black">Outstanding</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 🏪 Vendor Pending */}
          {activeAlert === 'vendors' && (
            <div>
              {m.vendorPending?.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <div className="text-4xl mb-2">✅</div>
                  <div className="font-bold">All vendor payments are cleared!</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                    Vendors awaiting payment
                  </p>
                  {m.vendorPending.map((v, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-700 flex items-center justify-center font-black text-lg">
                          🏪
                        </div>
                        <div>
                          <div className="font-black text-gray-900">{v.name}</div>
                          <div className="text-xs text-gray-500">{v.mobile} · {v.orderCount} order(s)</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-amber-700 text-lg">{fmt(v.pendingAmount)}</div>
                        <div className="text-[10px] text-gray-400 uppercase font-black">To Pay</div>
                      </div>
                    </div>
                  ))}
                  <Link to="/purchases" className="block text-center text-xs font-black text-blue-600 hover:underline mt-2">
                    Manage Purchases →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* 👤 Staff Today Sales (Admin Only) */}
          {activeAlert === 'staffSales' && (userInfo.role === 'Admin' || !userInfo.role) && (
            <div>
              {m.staffTodaySales?.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <div className="text-4xl mb-2">🧑‍💻</div>
                  <div className="font-bold">No staff sales recorded today yet.</div>
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                    Today's performance by staff members
                  </p>
                  {m.staffTodaySales.map((s, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                            {s.name[0]}
                          </div>
                          <div>
                            <div className="font-black text-gray-900">{s.name}</div>
                            <div className="text-xs text-gray-500">{s.count} invoice(s) generated today</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-blue-600 text-lg">{fmt(s.sales)}</div>
                          <div className="text-[10px] text-gray-400 uppercase font-black">Total Sold Today</div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, (s.sales / (m.staffTodaySales[0]?.sales || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Best Sellers + Recent Transactions (side by side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Best Sellers */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-white overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight">🎯 Best Selling Products</h2>
                <p className="text-gray-400 text-xs font-medium">Filter by time period</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[['all','All Time'],['today','Today'],['week','This Week'],['month','This Month'],['custom','Custom']].map(([val, label]) => (
                  <button key={val} onClick={() => handleBsRangeChange(val)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      bsRange === val ? 'bg-gray-900 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>{label}
                  </button>
                ))}
              </div>
            </div>
            {bsRange === 'custom' && (
              <div className="flex gap-3 mt-4 flex-wrap">
                <input type="date" value={bsFrom} onChange={e => setBsFrom(e.target.value)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400" />
                <input type="date" value={bsTo} onChange={e => setBsTo(e.target.value)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400" />
                <button onClick={() => fetchBestSellers('custom', bsFrom, bsTo)}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition">
                  Apply
                </button>
              </div>
            )}
          </div>
          <div className="p-6 space-y-3">
            {displayBestSellers.length === 0 ? (
              <p className="text-center py-6 text-gray-400 font-medium">No sales data for this period</p>
            ) : (
              displayBestSellers.map((p, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 transition">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-gray-100 text-gray-600' :
                    i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-gray-900 text-sm truncate">{p.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-lg font-bold">{p.category}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg font-mono font-bold">{p.barcode}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, (p.qty / (displayBestSellers[0]?.qty || 1)) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-gray-800 text-sm">{p.qty} units</div>
                    <div className="text-xs text-emerald-600 font-bold">{fmt(p.revenue)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-white overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">Recent Transactions</h2>
              <p className="text-gray-400 text-xs font-medium">Last 5 invoices</p>
            </div>
            <Link to="/invoices" className="text-xs font-black text-blue-600 hover:underline uppercase tracking-widest">
              View All →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {m.recentInvoices?.length === 0 ? (
              <p className="text-center py-10 text-gray-400 font-medium">No transactions yet</p>
            ) : (
              m.recentInvoices.map((inv) => (
                <div key={inv._id} className="flex items-center justify-between px-8 py-4 hover:bg-white transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-sm font-black text-gray-500">
                      {(inv.customer?.name || 'W')[0]}
                    </div>
                    <div>
                      <div className="font-black text-gray-900 text-sm">{inv.customer?.name || 'Walk-in'}</div>
                      <div className="text-[10px] text-gray-400 font-bold">
                        {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-gray-900">{fmt(inv.finalAmount)}</div>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
