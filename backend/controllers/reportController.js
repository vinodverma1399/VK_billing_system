const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const Expense = require('../models/Expense');
const Return = require('../models/Return');

// @desc    Get Sales Report (Daily/Monthly)
// @route   GET /api/reports/sales
// @access  Private
const getSalesReport = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query; // 'daily' or 'monthly'

    let matchStage = { user: req.ownerId, status: { $ne: 'Cancelled' } };
    if (startDate && endDate) {
      const endOfDay = new Date(endDate);
      if (!endDate.includes('T')) endOfDay.setUTCHours(23, 59, 59, 999);
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: endOfDay
      };
    } else if (startDate) {
      matchStage.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      const endOfDay = new Date(endDate);
      if (!endDate.includes('T')) endOfDay.setUTCHours(23, 59, 59, 999);
      matchStage.createdAt = { $lte: endOfDay };
    }

    let groupBy = {};
    if (type === 'daily') {
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" }
      };
    } else { // monthly
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      };
    }

    const pipeline = [];
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
      {
        $group: {
          _id: groupBy,
          totalRevenue: { $sum: "$finalAmount" },
          totalGst: { $sum: "$totalGst" },
          totalInvoices: { $sum: 1 },
          paidAmount: { $sum: "$amountPaid" },
          unpaidAmount: {
            $sum: { $subtract: ["$finalAmount", { $ifNull: ["$amountPaid", 0] }] }
          }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } }
    );

    const sales = await Invoice.aggregate(pipeline);

    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Vendor Purchases Report
// @route   GET /api/reports/vendor-purchases
// @access  Private
const getVendorPurchasesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let matchStage = { user: req.ownerId };
    if (startDate && endDate) {
      const endOfDay = new Date(endDate);
      if (!endDate.includes('T')) endOfDay.setUTCHours(23, 59, 59, 999);
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: endOfDay
      };
    } else if (startDate) {
      matchStage.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      const endOfDay = new Date(endDate);
      if (!endDate.includes('T')) endOfDay.setUTCHours(23, 59, 59, 999);
      matchStage.createdAt = { $lte: endOfDay };
    }

    const purchases = await Purchase.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$vendor",
          totalPurchases: { $sum: "$totalCost" },
          purchaseCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "vendorData"
        }
      },
      { $unwind: "$vendorData" },
      {
        $project: {
          vendorName: "$vendorData.name",
          vendorMobile: "$vendorData.mobile",
          totalPurchases: 1,
          purchaseCount: 1
        }
      },
      { $sort: { totalPurchases: -1 } }
    ]);

    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Paid vs Unpaid Bills Report
// @route   GET /api/reports/invoice-status
// @access  Private
const getInvoiceStatusReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { user: req.ownerId };
    if (startDate && endDate) {
      const endOfDay = new Date(endDate);
      if (!endDate.includes('T')) endOfDay.setUTCHours(23, 59, 59, 999);
      query.createdAt = { $gte: new Date(startDate), $lte: endOfDay };
    } else if (startDate) {
      query.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      const endOfDay = new Date(endDate);
      if (!endDate.includes('T')) endOfDay.setUTCHours(23, 59, 59, 999);
      query.createdAt = { $lte: endOfDay };
    }

    const invoices = await Invoice.find(query)
      .populate('customer', 'name mobile')
      .sort({ createdAt: -1 });

    const purchases = await Purchase.find(query)
      .populate('vendor', 'name')
      .sort({ createdAt: -1 });

    const summary = {
      totalSalesPaid: 0,
      totalSalesUnpaid: 0,
      totalPurchasesPaid: 0,
      totalPurchasesPending: 0,
      salesCount: 0,
      purchasesCount: 0
    };

    const details = [];

    invoices.forEach(inv => {
      if (inv.status === 'Cancelled') return; // skip cancelled
      summary.totalSalesPaid += (inv.amountPaid || 0);
      summary.totalSalesUnpaid += (inv.finalAmount - (inv.amountPaid || 0));
      summary.salesCount += 1;

      details.push({
        _id: inv._id,
        date: inv.createdAt,
        type: 'Sale',
        clientName: inv.customer?.name || 'Unknown Customer',
        amount: inv.finalAmount,
        status: inv.status || 'Paid'
      });
    });

    purchases.forEach(pur => {
      summary.totalPurchasesPaid += (pur.amountPaid || 0);
      summary.totalPurchasesPending += (pur.totalCost - (pur.amountPaid || 0));
      summary.purchasesCount += 1;

      details.push({
        _id: pur._id,
        date: pur.createdAt,
        type: 'Purchase',
        clientName: pur.vendor?.name || 'Unknown Vendor',
        amount: pur.totalCost,
        status: pur.status || 'Pending'
      });
    });

    details.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ summary, details });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get GST Monthly Report data
// @route   GET /api/reports/gst
// @access  Private / Admin
const getGstReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { user: req.ownerId, status: { $ne: 'Cancelled' } };
    if (startDate && endDate) {
      const endOfDay = new Date(endDate);
      if (!endDate.includes('T')) endOfDay.setUTCHours(23, 59, 59, 999);
      query.createdAt = { $gte: new Date(startDate), $lte: endOfDay };
    } else if (startDate) {
      query.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      const endOfDay = new Date(endDate);
      if (!endDate.includes('T')) endOfDay.setUTCHours(23, 59, 59, 999);
      query.createdAt = { $lte: endOfDay };
    }

    const invoices = await Invoice.find(query)
      .populate('customer', 'name mobile address')
      .populate('products.product', 'gst name')
      .sort({ createdAt: 1 }); // Sort by date ascending

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Profit & Loss Report
// @route   GET /api/reports/pl
// @access  Private / Admin
const getPLReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.ownerId;

    const buildDateQuery = () => {
      const q = {};
      if (startDate) {
        const s = new Date(startDate);
        q.$gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        if (!endDate.includes('T')) e.setUTCHours(23, 59, 59, 999);
        q.$lte = e;
      }
      return Object.keys(q).length ? q : null;
    };

    const dateRange = buildDateQuery();

    // --- Revenue from Sales ---
    const invoiceQuery = { user: userId, status: { $ne: 'Cancelled' } };
    if (dateRange) invoiceQuery.createdAt = dateRange;
    const invoices = await Invoice.find(invoiceQuery);
    const totalRevenue = invoices.reduce((s, i) => s + i.finalAmount, 0);
    const totalGst = invoices.reduce((s, i) => s + (i.totalGst || 0), 0);
    const totalDiscount = invoices.reduce((s, i) => s + (i.totalDiscount || 0), 0);
    const totalPaid = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
    const totalUnpaid = totalRevenue - totalPaid;
    const revenueExGst = totalRevenue - totalGst;

    // --- Cost of Goods (Purchases) ---
    const purchaseQuery = { user: userId };
    if (dateRange) purchaseQuery.createdAt = dateRange;
    const purchases = await Purchase.find(purchaseQuery);
    const totalCOGS = purchases.reduce((s, p) => s + p.totalCost, 0);

    // --- Expenses ---
    const expenseQuery = { user: userId };
    if (dateRange) expenseQuery.date = dateRange;
    const expenses = await Expense.find(expenseQuery);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    // Breakdown by category
    const expenseByCategory = {};
    expenses.forEach(e => {
      const cat = e.category || 'Other';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + e.amount;
    });

    // --- Returns / Refunds (Approved) ---
    const returnQuery = { user: userId, status: 'Approved' };
    if (dateRange) returnQuery.createdAt = dateRange;
    const returns = await Return.find(returnQuery);
    const totalRefunds = returns.reduce((s, r) => s + r.totalRefund, 0);

    // --- Profit Calculations ---
    const grossProfit = totalRevenue - totalCOGS - totalRefunds;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;
    const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    // Monthly breakdown of revenue
    const monthlyBreakdown = {};
    invoices.forEach(inv => {
      const d = new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyBreakdown[key]) monthlyBreakdown[key] = { revenue: 0, gst: 0, invoices: 0 };
      monthlyBreakdown[key].revenue += inv.finalAmount;
      monthlyBreakdown[key].gst += (inv.totalGst || 0);
      monthlyBreakdown[key].invoices += 1;
    });

    res.json({
      // Revenue
      totalRevenue, totalGst, totalDiscount, revenueExGst,
      totalPaid, totalUnpaid,
      invoiceCount: invoices.length,
      // Cost
      totalCOGS, purchaseCount: purchases.length,
      // Expenses
      totalExpenses, expenseCount: expenses.length, expenseByCategory,
      // Returns
      totalRefunds, returnCount: returns.length,
      // Profit
      grossProfit, netProfit, grossMargin, netMargin,
      // Breakdown
      monthlyBreakdown
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSalesReport,
  getVendorPurchasesReport,
  getInvoiceStatusReport,
  getGstReport,
  getPLReport
};
