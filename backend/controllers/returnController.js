const Return = require('../models/Return');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const { logAudit } = require('./auditController');

// @desc    Get all returns for logged-in user
// @route   GET /api/returns
// @access  Private
const getReturns = async (req, res) => {
  try {
    let query = { user: req.ownerId };
    if (req.user.role === 'Staff') {
      query.createdBy = req.user._id;
    }
    const returns = await Return.find(query)
      .populate('invoice', 'invoiceNumber finalAmount createdAt status')
      .populate('createdBy', 'name')
      .populate('customer', 'name mobile')
      .populate('returnedProducts.product', 'name barcode category unit')
      .sort({ createdAt: -1 });
    res.json(returns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a return — starts as Pending, stock NOT restored yet
// @route   POST /api/returns
// @access  Private
const createReturn = async (req, res) => {
  try {
    const { invoiceId, returnedProducts, reason } = req.body;

    if (!returnedProducts || returnedProducts.length === 0) {
      return res.status(400).json({ message: 'Select at least one product to return' });
    }

    // Verify invoice belongs to this user
    const invoice = await Invoice.findOne({ _id: invoiceId, user: req.ownerId })
      .populate('products.product')
      .populate('customer');

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cannot return items from a cancelled invoice' });
    }

    let totalRefund = 0;
    const processedProducts = [];

    // Calculate sum of all product totals to distribute invoice-level discount proportionally
    const allItemsTotal = invoice.products.reduce((sum, p) => sum + p.total, 0);
    const invoiceDiscount = invoice.totalDiscount || 0;

    for (const item of returnedProducts) {
      const invoiceItem = invoice.products.find(
        p => (p.product?._id || p.product)?.toString() === item.productId
      );

      if (!invoiceItem) {
        return res.status(400).json({ message: `Product not found in original invoice` });
      }

      // Calculate how many are still returnable (purchased - already returned)
      const alreadyReturned = invoiceItem.returnedQty || 0;
      const maxReturnable = invoiceItem.quantity - alreadyReturned;

      if (item.quantity > maxReturnable) {
        return res.status(400).json({
          message: `Cannot return ${item.quantity} units of ${invoiceItem.product?.name || 'Unknown Product'}. Only ${maxReturnable} returnable (${invoiceItem.quantity} purchased, ${alreadyReturned} already returned).`
        });
      }

      if (item.quantity <= 0) {
        return res.status(400).json({ message: `Return quantity must be greater than 0` });
      }

      // Proportionally distribute invoice-level discount to this item
      const itemDiscountShare = allItemsTotal > 0 ? (invoiceItem.total / allItemsTotal) * invoiceDiscount : 0;
      const effectiveItemTotal = invoiceItem.total - itemDiscountShare;
      const refundPerUnit = effectiveItemTotal / invoiceItem.quantity;
      const refundAmount = refundPerUnit * item.quantity;
      totalRefund += refundAmount;

      processedProducts.push({
        product: item.productId,
        productName: invoiceItem.product?.name || 'Unknown Product',
        quantity: item.quantity,
        price: invoiceItem.price,
        refundAmount: parseFloat(refundAmount.toFixed(2)),
        condition: item.condition || 'Good'
      });
    }

    // Create return with Pending status — stock only restores on Approve
    const newReturn = await Return.create({
      invoice: invoiceId,
      customer: invoice.customer?._id,
      returnedProducts: processedProducts,
      totalRefund: parseFloat(totalRefund.toFixed(2)),
      reason: reason || 'Customer Return',
      status: 'Pending',
      user: req.ownerId,
      createdBy: req.user._id
    });

    // IMMEDIATELY update returnedQty on the invoice so the user cannot submit another return for the same items while Pending
    for (const item of processedProducts) {
      const invProduct = invoice.products.find(
        p => (p.product?._id || p.product)?.toString() === item.product.toString()
      );
      if (invProduct) {
        invProduct.returnedQty = (invProduct.returnedQty || 0) + item.quantity;
      }
    }
    await invoice.save();

    await newReturn.populate([
      { path: 'invoice', select: 'invoiceNumber finalAmount createdAt' },
      { path: 'customer', select: 'name mobile' },
      { path: 'returnedProducts.product', select: 'name barcode category unit' }
    ]);

    res.status(201).json(newReturn);

    await logAudit(
      'Created Return Request',
      'Return',
      req.user._id,
      req.ownerId,
      newReturn._id,
      `Requested return for invoice ${invoice.invoiceNumber}. Total Refund: ₹${totalRefund}`
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update return status — Approve restores stock + updates invoice, Reject undoes it
// @route   PUT /api/returns/:id/status
// @access  Private
const updateReturnStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use Pending, Approved, or Rejected.' });
    }

    const returnDoc = await Return.findOne({ _id: req.params.id, user: req.ownerId });
    if (!returnDoc) return res.status(404).json({ message: 'Return not found' });

    const prev = returnDoc.status;

    // If no actual change, just return
    if (prev === status) {
      return res.json(returnDoc);
    }

    // ── Once Approved or Rejected, it is FINAL — cannot be changed ──
    if (prev === 'Approved') {
      return res.status(400).json({ message: 'Approved returns cannot be changed. This action is final.' });
    }
    if (prev === 'Rejected') {
      return res.status(400).json({ message: 'Rejected returns cannot be changed. This action is final.' });
    }

    const invoice = await Invoice.findOne({ _id: returnDoc.invoice, user: req.ownerId });

    // ── APPROVE: restore stock (non-defective only) ──
    if (status === 'Approved') {
      for (const item of returnDoc.returnedProducts) {
        // Restore stock only for non-defective (Good) items
        if (item.condition !== 'Defective') {
          const product = await Product.findOne({ _id: item.product, user: req.ownerId });
          if (product) {
            product.stock += item.quantity;
            await product.save();
          }
        }
      }
      // Note: returnedQty on invoice is already updated during createReturn!
    }

    // ── REJECT: undo the returnedQty on the invoice since it was locked in Pending ──
    if (status === 'Rejected') {
      if (invoice) {
        for (const item of returnDoc.returnedProducts) {
          const invProduct = invoice.products.find(
            p => (p.product?._id || p.product)?.toString() === item.product.toString()
          );
          if (invProduct) {
            invProduct.returnedQty = Math.max(0, (invProduct.returnedQty || 0) - item.quantity);
          }
        }
        await invoice.save();
      }
    }

    returnDoc.status = status;
    await returnDoc.save();

    await returnDoc.populate([
      { path: 'invoice', select: 'invoiceNumber finalAmount createdAt' },
      { path: 'customer', select: 'name mobile' },
      { path: 'returnedProducts.product', select: 'name barcode category unit' }
    ]);

    res.json(returnDoc);

    await logAudit(
      `${status} Return`,
      'Return',
      req.user._id,
      req.ownerId,
      returnDoc._id,
      `${status} return request from #${returnDoc._id.toString().substring(18).toUpperCase()}`
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getReturns, createReturn, updateReturnStatus };
