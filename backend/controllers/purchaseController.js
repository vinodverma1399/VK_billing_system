const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');

// @desc    Get all purchases
// @route   GET /api/purchases
// @access  Private
const getPurchases = async (req, res) => {
  try {
    let query = { user: req.ownerId };
    if (req.user.role === 'Staff') {
      query.createdBy = req.user._id;
    }
    const purchases = await Purchase.find(query)
      .populate('vendor', 'name mobile')
      .populate('createdBy', 'name')
      .populate('products.product', 'name barcode')
      .sort({ purchaseDate: -1 });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new purchase / stock entry
// @route   POST /api/purchases
// @access  Private
const createPurchase = async (req, res) => {
  try {
    const { vendorId, products } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ message: 'No products in purchase' });
    }

    let totalCost = 0;

    const purchaseProducts = await Promise.all(products.map(async (p) => {
      const product = await Product.findOne({ _id: p.product, user: req.ownerId });
      if (!product) throw new Error(`Product not found`);

      const qty = p.quantity;
      const price = p.purchasePrice;
      const itemTotal = qty * price;

      totalCost += itemTotal;

      // Update product stock automatically
      product.stock += qty;
      // Optional: update the retail price based on new purchase if required
      await product.save();

      return {
        product: product._id,
        quantity: qty,
        purchasePrice: price,
        total: itemTotal
      };
    }));

    const amountPaid = Number(req.body.amountPaid) || 0;
    const status = amountPaid >= totalCost ? 'Paid' : 'Pending';

    const purchase = await Purchase.create({
      vendor: vendorId,
      products: purchaseProducts,
      totalCost,
      amountPaid,
      status,
      createdBy: req.user._id,
      user: req.ownerId
    });

    res.status(201).json(purchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a vendor payment (partial or full)
// @route   PUT /api/purchases/:id/pay
// @access  Private / Admin
const updatePurchaseStatus = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({ _id: req.params.id, user: req.ownerId });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

    const { amount, method, note } = req.body;
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    const pending = purchase.totalCost - purchase.amountPaid;
    if (payAmount > pending) {
      return res.status(400).json({ message: `Amount exceeds pending balance of ₹${pending.toFixed(2)}` });
    }

    // Push into history
    purchase.payments.push({
      amount: payAmount,
      method: method || 'Cash',
      note: note || '',
      paidAt: new Date()
    });

    purchase.amountPaid = purchase.amountPaid + payAmount;
    purchase.status = purchase.amountPaid >= purchase.totalCost ? 'Paid' : 'Pending';

    await purchase.save();
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPurchases, createPurchase, updatePurchaseStatus };
