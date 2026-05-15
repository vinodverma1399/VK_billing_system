const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Return = require('../models/Return');

// @desc    Get dashboard metrics (smart/automatic)
// @route   GET /api/dashboard/metrics
// @access  Private
const getMetrics = async (req, res) => {
  try {
    const userId = req.ownerId;

    // ── Core Counts ──────────────────────────────────────────────
    const totalCustomers = await Customer.countDocuments({ user: userId });
    const totalProducts = await Product.countDocuments({ user: userId });
    const totalInvoices = await Invoice.countDocuments({ user: userId, status: { $ne: 'Cancelled' } });

    // ── Revenue & GST (all active invoices) ──────────────────────
    const invoices = await Invoice.find({ user: userId, status: { $ne: 'Cancelled' } });
    let totalRevenue = 0, totalGst = 0, paidAmount = 0, unpaidAmount = 0;
    invoices.forEach(inv => {
      totalRevenue += inv.finalAmount;
      totalGst += inv.totalGst || 0;
      paidAmount += (inv.amountPaid || 0);
      unpaidAmount += (inv.finalAmount - (inv.amountPaid || 0));
    });

    // ── Today vs Yesterday Sales ──────────────────────────────────
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(todayStart.getDate() - 1);

    const todayInvoices = invoices.filter(inv => new Date(inv.createdAt) >= todayStart);
    const yesterdayInvoices = invoices.filter(inv => {
      const d = new Date(inv.createdAt);
      return d >= yesterdayStart && d < todayStart;
    });

    let todaySales = todayInvoices.reduce((s, i) => s + i.finalAmount, 0);
    const yesterdaySales = yesterdayInvoices.reduce((s, i) => s + i.finalAmount, 0);
    let todayGst = todayInvoices.reduce((s, i) => s + (i.totalGst || 0), 0);

    // ── 👤 Staff-wise Today's Sales ───────────────────────────────
    // First, get all users involved in today's invoices
    await Invoice.populate(todayInvoices, { path: 'createdBy', select: 'name role' });
    const staffSalesMap = {};
    todayInvoices.forEach(inv => {
      const staffName = inv.createdBy?.name || 'Unknown Staff';
      if (!staffSalesMap[staffName]) {
        staffSalesMap[staffName] = { name: staffName, sales: 0, count: 0 };
      }
      staffSalesMap[staffName].sales += inv.finalAmount;
      staffSalesMap[staffName].count += 1;
    });
    const staffTodaySales = Object.values(staffSalesMap).sort((a, b) => b.sales - a.sales);
    console.log('Staff Today Sales Calculated:', staffTodaySales);


    // ── Returns & Refunds (Approved) ──────────────────────────────
    // ── Returns & Refunds (Approved) ──────────────────────────────
    const approvedReturns = await Return.find({ user: userId, status: 'Approved' }).populate('invoice');
    let totalRefunds = 0;
    let todayRefunds = 0;
    let totalReturnedGst = 0;
    let todayReturnedGst = 0;

    approvedReturns.forEach(ret => {
      totalRefunds += ret.totalRefund;
      if (new Date(ret.createdAt) >= todayStart) {
        todayRefunds += ret.totalRefund;
      }

      if (ret.invoice && ret.invoice.products) {
        let returnGst = 0;
        ret.returnedProducts.forEach(rp => {
          const invItem = ret.invoice.products.find(p => p.product.toString() === rp.product.toString());
          if (invItem && invItem.total > 0) {
            const gstRatio = (invItem.gst || 0) / invItem.total;
            returnGst += rp.refundAmount * gstRatio;
          }
        });
        totalReturnedGst += returnGst;
        if (new Date(ret.createdAt) >= todayStart) {
          todayReturnedGst += returnGst;
        }
      }
    });

    // Note: User requested manual accounting for returns.
    // Core metrics (totalRevenue, todaySales, totalGst, todayGst) remain untouched.
    const salesGrowth = yesterdaySales === 0
      ? (todaySales > 0 ? 100 : 0)
      : (((todaySales - yesterdaySales) / yesterdaySales) * 100).toFixed(1);

    // ── 🔴 Low Stock Alerts ───────────────────────────────────────
    const allProducts = await Product.find({ user: userId });
    const lowStockProducts = allProducts
      .filter(p => p.stock <= p.lowStockThreshold)
      .map(p => ({
        _id: p._id,
        name: p.name,
        stock: p.stock,
        threshold: p.lowStockThreshold,
        price: p.price
      }))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    // ── ⏰ Overdue Unpaid Invoices (> 7 days) ──────────────────────
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
    const overdueInvoices = await Invoice.find({
      user: userId,
      status: { $in: ['Unpaid', 'Partial'] },
      createdAt: { $lte: sevenDaysAgo }
    })
      .populate('customer', 'name mobile')
      .sort({ createdAt: 1 })
      .limit(10);

    const overdueList = overdueInvoices.map(inv => ({
      _id: inv._id,
      customerName: inv.customer?.name || 'Walk-in',
      customerMobile: inv.customer?.mobile || '—',
      amount: inv.finalAmount - (inv.amountPaid || 0),
      status: inv.status,
      daysOverdue: Math.floor((now - new Date(inv.createdAt)) / (1000 * 60 * 60 * 24))
    }));

    // ── 💰 Gross Profit Calculation ───────────────────────────────
    // Revenue already calculated above; calculate COGS from purchases
    const purchases = await Purchase.find({ user: userId });
    const totalCOGS = purchases.reduce((s, p) => s + p.totalCost, 0);
    const grossProfit = totalRevenue - totalCOGS;
    const profitMargin = totalRevenue === 0 ? 0 : ((grossProfit / totalRevenue) * 100).toFixed(1);

    // ── 📊 Customer Outstanding Balances (top 5 debtors) ──────────
    const unpaidInvoices = await Invoice.find({
      user: userId,
      status: { $in: ['Unpaid', 'Partial'] }
    }).populate('customer', 'name mobile');

    const customerBalanceMap = {};
    unpaidInvoices.forEach(inv => {
      const cId = inv.customer?._id?.toString() || 'unknown';
      if (!customerBalanceMap[cId]) {
        customerBalanceMap[cId] = {
          name: inv.customer?.name || 'Unknown',
          mobile: inv.customer?.mobile || '—',
          outstanding: 0,
          invoiceCount: 0
        };
      }
      customerBalanceMap[cId].outstanding += (inv.finalAmount - (inv.amountPaid || 0));
      customerBalanceMap[cId].invoiceCount += 1;
    });
    const customerOutstanding = Object.values(customerBalanceMap)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5);

    // ── 🏪 Vendor Pending Bills ───────────────────────────────────
    const pendingPurchases = await Purchase.find({
      user: userId,
      status: 'Pending'
    }).populate('vendor', 'name mobile');

    const vendorBalanceMap = {};
    pendingPurchases.forEach(pur => {
      const vId = pur.vendor?._id?.toString() || 'unknown';
      const pending = pur.totalCost - pur.amountPaid;
      if (!vendorBalanceMap[vId]) {
        vendorBalanceMap[vId] = {
          name: pur.vendor?.name || 'Unknown Vendor',
          mobile: pur.vendor?.mobile || '—',
          pendingAmount: 0,
          orderCount: 0
        };
      }
      vendorBalanceMap[vId].pendingAmount += pending;
      vendorBalanceMap[vId].orderCount += 1;
    });
    const vendorPending = Object.values(vendorBalanceMap)
      .sort((a, b) => b.pendingAmount - a.pendingAmount)
      .slice(0, 5);

    // ── 🎯 Best Selling Products ──────────────────────────────────
    const salesByProduct = {};
    invoices.forEach(inv => {
      (inv.products || []).forEach(item => {
        const pId = item.product?.toString() || 'unknown';
        if (!salesByProduct[pId]) salesByProduct[pId] = { productId: pId, qty: 0, revenue: 0 };
        salesByProduct[pId].qty += item.quantity;
        salesByProduct[pId].revenue += item.total;
      });
    });

    // Enrich with product details
    const productMap = {};
    allProducts.forEach(p => { 
      productMap[p._id.toString()] = {
        name: p.name,
        category: p.category || '-',
        barcode: p.barcode || 'N/A'
      };
    });
    const bestSellers = Object.values(salesByProduct)
      .map(s => ({ 
        ...s, 
        name: productMap[s.productId]?.name || 'Unknown',
        category: productMap[s.productId]?.category || '-',
        barcode: productMap[s.productId]?.barcode || 'N/A'
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // ── Recent 5 invoices ─────────────────────────────────────────
    const recentInvoices = await Invoice.find({ user: userId, status: { $ne: 'Cancelled' } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('customer', 'name mobile');

    res.json({
      // Core
      totalCustomers, totalProducts, totalInvoices,
      totalRevenue, totalGst, paidAmount, unpaidAmount,
      // Smart
      todaySales, yesterdaySales, todayGst, salesGrowth,
      grossProfit, profitMargin, totalCOGS,
      lowStockProducts,
      overdueList,
      customerOutstanding,
      vendorPending,
      bestSellers,
      recentInvoices,
      totalRefunds,
      staffTodaySales
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Get best sellers filtered by date range
// @route   GET /api/dashboard/best-sellers?range=today|week|month|custom&from=&to=
// @access  Private
const getBestSellers = async (req, res) => {
  try {
    const userId = req.ownerId;
    const { range, from, to } = req.query;

    const now = new Date();
    let startDate, endDate = now;

    if (range === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === 'week') {
      startDate = new Date(now); startDate.setDate(now.getDate() - 7);
    } else if (range === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === 'custom' && from && to) {
      startDate = new Date(from);
      endDate = new Date(to); endDate.setHours(23, 59, 59, 999);
    } else {
      // All time
      startDate = new Date('2020-01-01');
    }

    const invoices = await Invoice.find({
      user: userId,
      status: { $ne: 'Cancelled' },
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const allProducts = await Product.find({ user: userId });
    const productMap = {};
    allProducts.forEach(p => {
      productMap[p._id.toString()] = {
        name: p.name,
        category: p.category || '-',
        barcode: p.barcode || 'N/A'
      };
    });

    const salesByProduct = {};
    invoices.forEach(inv => {
      (inv.products || []).forEach(item => {
        const pId = item.product?.toString() || 'unknown';
        if (!salesByProduct[pId]) salesByProduct[pId] = { productId: pId, qty: 0, revenue: 0 };
        salesByProduct[pId].qty += item.quantity;
        salesByProduct[pId].revenue += item.total;
      });
    });

    const bestSellers = Object.values(salesByProduct)
      .map(s => ({
        ...s,
        name: productMap[s.productId]?.name || 'Unknown',
        category: productMap[s.productId]?.category || '-',
        barcode: productMap[s.productId]?.barcode || 'N/A'
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    res.json({ bestSellers, from: startDate, to: endDate });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMetrics, getBestSellers };
