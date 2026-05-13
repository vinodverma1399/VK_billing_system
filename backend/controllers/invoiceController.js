const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const { logAudit } = require('./auditController');

// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private
const createInvoice = async (req, res) => {
  try {
    const { customerMobile, customerName, products, totalDiscount, status, amountPaid } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ message: 'No products in invoice' });
    }

    // Find or create customer
    let customer = await Customer.findOne({ mobile: customerMobile, user: req.ownerId });
    if (!customer) {
      customer = await Customer.create({
        mobile: customerMobile,
        name: customerName || 'Unknown',
        user: req.ownerId
      });
    }

    let subTotal = 0;
    let totalGst = 0;

    // Process products and calculate
    const invoiceProducts = await Promise.all(products.map(async (p) => {
      const product = await Product.findOne({ _id: p.product, user: req.ownerId });
      if (!product) throw new Error(`Product ${p.product} not found`);

      const price = product.price;
      const qty = p.quantity;
      const gstPercent = product.gst;
      const discount = p.discount || 0;

      const itemTotalBeforeTax = (price * qty) - discount;
      const itemGst = (itemTotalBeforeTax * gstPercent) / 100;
      const itemFinalTotal = itemTotalBeforeTax + itemGst;

      subTotal += itemTotalBeforeTax;
      totalGst += itemGst;

      if (product.stock < qty) {
        throw new Error(`Insufficient stock for ${product.name}. Only ${product.stock} available.`);
      }
      product.stock -= qty;
      await product.save();

      return {
        product: product._id,
        quantity: qty,
        price: price,
        gst: itemGst,
        discount: discount,
        total: itemFinalTotal
      };
    }));

    const finalAmount = subTotal + totalGst - (totalDiscount || 0);
    const invoiceStatus = status || 'Paid';
    const finalAmountPaid = invoiceStatus === 'Paid' ? finalAmount : (invoiceStatus === 'Unpaid' ? 0 : (Number(amountPaid) || 0));

    // Auto-generate invoice number INV-YYYY-XXXX
    const year = new Date().getFullYear();
    const count = await Invoice.countDocuments({ user: req.ownerId });
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await Invoice.create({
      invoiceNumber,
      customer: customer._id,
      products: invoiceProducts,
      subTotal,
      totalDiscount: totalDiscount || 0,
      totalGst,
      finalAmount,
      amountPaid: finalAmountPaid,
      status: invoiceStatus,
      payments: finalAmountPaid > 0 ? [{ amount: finalAmountPaid, method: 'Cash', note: 'Initial payment' }] : [],
      createdBy: req.user._id,
      user: req.ownerId
    });

    // Populate details for the frontend (especially for the PDF)
    await invoice.populate([
      { path: 'customer', select: 'name mobile' },
      { path: 'products.product', select: 'name barcode gst stock' }
    ]);

    // Emit event
    if (req.io) {
      req.io.emit('new-invoice', invoice);
    }

    await logAudit(
      'Created Invoice',
      'Invoice',
      req.user._id,
      req.ownerId,
      invoice._id,
      `Generated invoice ${invoiceNumber} for ₹${finalAmount}`
    );

    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
const getInvoices = async (req, res) => {
  try {
    let query = { user: req.ownerId };
    if (req.user.role === 'Staff') {
      query.createdBy = req.user._id;
    }
    const invoices = await Invoice.find(query)
      .populate('customer', 'name mobile')
      .populate('createdBy', 'name role')
      .populate('products.product', 'name barcode gst stock')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get ALL shop invoices (for return creation — any staff can return any bill)
// @route   GET /api/invoices/shop-all
// @access  Private
const getShopInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.ownerId })
      .populate('customer', 'name mobile')
      .populate('createdBy', 'name role')
      .populate('products.product', 'name barcode gst stock')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel an invoice (restores stock)
// @route   PUT /api/invoices/:id/cancel
// @access  Private
const cancelInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.ownerId })
      .populate('products.product');

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'Cancelled') {
      return res.status(400).json({ message: 'Invoice is already cancelled' });
    }

    // Restore stock for each product
    for (const item of invoice.products) {
      const product = await Product.findOne({ _id: item.product._id, user: req.ownerId });
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    invoice.status = 'Cancelled';
    await invoice.save();
    res.json({ message: 'Invoice cancelled successfully', invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update invoice payment status
// @route   PUT /api/invoices/:id/status
// @access  Private
const updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['Paid', 'Unpaid', 'Partial'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.ownerId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cannot update a cancelled invoice' });
    }

    invoice.status = status;
    await invoice.save();
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an existing invoice (reverses old stock, recalculates)
// @route   PUT /api/invoices/:id
// @access  Private
const updateInvoice = async (req, res) => {
  try {
    const { products, totalDiscount, status, amountPaid } = req.body;

    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.ownerId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cannot edit a cancelled invoice' });
    }

    // Step 1: Restore old product stocks
    for (const item of invoice.products) {
      const product = await Product.findOne({ _id: item.product, user: req.ownerId });
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    // Step 2: Recalculate with new products
    let subTotal = 0;
    let totalGst = 0;

    const invoiceProducts = await Promise.all(products.map(async (p) => {
      const product = await Product.findOne({ _id: p.product, user: req.ownerId });
      if (!product) throw new Error(`Product ${p.product} not found`);

      const price = product.price;
      const qty = p.quantity;
      const gstPercent = product.gst;
      const discount = p.discount || 0;

      const itemTotalBeforeTax = (price * qty) - discount;
      const itemGst = (itemTotalBeforeTax * gstPercent) / 100;
      const itemFinalTotal = itemTotalBeforeTax + itemGst;

      subTotal += itemTotalBeforeTax;
      totalGst += itemGst;

      // Deduct updated stock
      if (product.stock < qty) {
        throw new Error(`Insufficient stock for ${product.name}. Only ${product.stock} available.`);
      }
      product.stock -= qty;
      await product.save();

      return {
        product: product._id,
        quantity: qty,
        price: price,
        gst: itemGst,
        discount: discount,
        total: itemFinalTotal
      };
    }));

    const finalAmount = subTotal + totalGst - (totalDiscount || 0);

    // Step 3: Save updated invoice
    invoice.products = invoiceProducts;
    invoice.subTotal = subTotal;
    invoice.totalDiscount = totalDiscount || 0;
    invoice.totalGst = totalGst;
    invoice.finalAmount = finalAmount;

    if (amountPaid !== undefined) {
      invoice.amountPaid = status === 'Paid' ? finalAmount : (status === 'Unpaid' ? 0 : Number(amountPaid));
      invoice.status = status || invoice.status;
    } else if (status && status !== 'Cancelled') {
      invoice.status = status;
      if (status === 'Paid') invoice.amountPaid = finalAmount;
      if (status === 'Unpaid') invoice.amountPaid = 0;
    } else {
      if (invoice.amountPaid >= finalAmount) {
        invoice.status = 'Paid';
        invoice.amountPaid = finalAmount; // Cap to new amount if bill was reduced
      } else if (invoice.amountPaid > 0) {
        invoice.status = 'Partial';
      } else {
        invoice.status = 'Unpaid';
      }
    }

    await invoice.save();
    await invoice.populate([
      { path: 'customer', select: 'name mobile' },
      { path: 'products.product', select: 'name barcode gst stock' }
    ]);

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a payment to an invoice (partial payment ledger)
// @route   POST /api/invoices/:id/payments
// @access  Private
const addPayment = async (req, res) => {
  try {
    const { amount, method, note } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid payment amount required' });

    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.ownerId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'Cancelled') return res.status(400).json({ message: 'Cannot add payment to cancelled invoice' });

    invoice.payments.push({ amount: Number(amount), method: method || 'Cash', note: note || '' });
    invoice.amountPaid = (invoice.amountPaid || 0) + Number(amount);

    // Auto-update status
    if (invoice.amountPaid >= invoice.finalAmount) {
      invoice.amountPaid = invoice.finalAmount;
      invoice.status = 'Paid';
    } else if (invoice.amountPaid > 0) {
      invoice.status = 'Partial';
    }

    await invoice.save();
    await invoice.populate('customer', 'name mobile');
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createInvoice, getInvoices, getShopInvoices, cancelInvoice, updateInvoiceStatus, updateInvoice, addPayment };
