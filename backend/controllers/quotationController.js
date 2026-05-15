const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');
const Customer = require('../models/Customer');
const { logAudit } = require('./auditController');

// @desc    Create a quotation
// @route   POST /api/quotations
// @access  Private
const createQuotation = async (req, res) => {
  try {
    const { customerId, customerName, customerMobile, products, totalDiscount, amountPaid } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ message: 'No products selected' });
    }

    let customer;
    if (customerId) {
      customer = await Customer.findById(customerId);
    } else {
      let cust = await Customer.findOne({ mobile: customerMobile, user: req.ownerId });
      if (!cust && customerMobile) {
        cust = await Customer.create({ name: customerName || 'Walk-in', mobile: customerMobile, user: req.ownerId, createdBy: req.user._id });
      } else if (!cust) {
        cust = await Customer.create({ name: 'Walk-in Customer', mobile: '0000000000', user: req.ownerId, createdBy: req.user._id });
      }
      customer = cust;
    }

    let subTotal = 0;
    let totalGst = 0;

    const quotationProducts = products.map(item => {
      const price = Number(item.price);
      const qty = Number(item.quantity);
      const discount = Number(item.discount || 0);
      const itemGst = Number(item.gst || 0);
      
      const baseTotal = price * qty;
      const afterDiscount = baseTotal - discount;
      const gstAmount = (afterDiscount * itemGst) / 100;
      const itemFinalTotal = afterDiscount + gstAmount;

      subTotal += afterDiscount;
      totalGst += gstAmount;

      // Notice: NO STOCK DEDUCTION HERE!

      return {
        product: item.product,
        quantity: qty,
        price: price,
        gst: itemGst,
        discount: discount,
        total: itemFinalTotal
      };
    });

    const finalAmount = subTotal + totalGst - (Number(totalDiscount) || 0);

    const year = new Date().getFullYear();
    const count = await Quotation.countDocuments({ user: req.ownerId });
    const quotationNumber = `EST-${year}-${String(count + 1).padStart(4, '0')}`;

    const quotation = await Quotation.create({
      quotationNumber,
      customer: customer._id,
      products: quotationProducts,
      subTotal,
      totalDiscount: Number(totalDiscount) || 0,
      totalGst,
      finalAmount,
      status: 'Estimate',
      createdBy: req.user._id,
      user: req.ownerId
    });

    await quotation.populate([
      { path: 'customer', select: 'name mobile' },
      { path: 'products.product', select: 'name barcode gst unit category' }
    ]);

    await logAudit('Created Quotation', 'Quotation', req.user._id, req.ownerId, quotation._id, `Created estimate ${quotationNumber} for ₹${finalAmount}`);

    res.status(201).json(quotation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all quotations
// @route   GET /api/quotations
// @access  Private
const getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({ user: req.ownerId })
      .populate('customer', 'name mobile')
      .populate('products.product', 'name barcode unit')
      .sort('-createdAt');
    res.json(quotations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a quotation
// @route   DELETE /api/quotations/:id
// @access  Private / Admin
const deleteQuotation = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') return res.status(403).json({ message: 'Not authorized' });

    const quotation = await Quotation.findOneAndDelete({ _id: req.params.id, user: req.ownerId });
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

    await logAudit('Deleted Quotation', 'Quotation', req.user._id, req.ownerId, null, `Deleted estimate ${quotation.quotationNumber}`);

    res.json({ message: 'Quotation removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createQuotation, getQuotations, deleteQuotation };
