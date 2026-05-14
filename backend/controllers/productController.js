const mongoose = require('mongoose');
const Product = require('../models/Product');
const { logAudit } = require('./auditController');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ user: req.ownerId })
      .populate('createdBy', 'name');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get product by barcode or ID
// @route   GET /api/products/barcode/:barcode
// @access  Private
const getProductByBarcode = async (req, res) => {
  try {
    const searchParam = req.params.barcode;
    const searchParamTrimmed = searchParam.trim();
    const searchRegex = new RegExp(`^${searchParamTrimmed.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');

    let query = {
      $or: [
        { barcode: searchParamTrimmed },
        { name: searchRegex }
      ]
    };

    if (mongoose.Types.ObjectId.isValid(searchParamTrimmed)) {
      query.$or.push({ _id: searchParamTrimmed });
    }

    // Only return active products for billing
    const queryWithUser = { ...query, user: req.ownerId, status: 'active' };
    const product = await Product.findOne(queryWithUser);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private (Staff → pending, Admin → active)
const createProduct = async (req, res) => {
  try {
    const { name, category, unit, price, gst, barcode, stock, costPrice, lowStockThreshold } = req.body;

    // Staff submissions go pending; Admin submissions go directly active
    const status = req.user.role === 'Staff' ? 'pending' : 'active';

    const product = await Product.create({
      name,
      category,
      unit: unit || 'Piece',
      price,
      gst: gst || 0,
      barcode: barcode || undefined,
      stock: stock || 0,
      costPrice: costPrice || 0,
      lowStockThreshold: lowStockThreshold !== undefined ? lowStockThreshold : 5,
      status,
      createdBy: req.user._id,
      user: req.ownerId
    });

    await logAudit(
      status === 'pending' ? 'Requested Product' : 'Created Product',
      'Product',
      req.user._id,
      req.ownerId,
      product._id,
      `${status === 'pending' ? 'Staff requested' : 'Admin created'} product ${name} (${category})`
    );

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve a pending product (Admin only)
// @route   PUT /api/products/:id/approve
// @access  Private / Admin
const approveProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, user: req.ownerId });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.status === 'active') return res.status(400).json({ message: 'Product already active' });

    product.status = 'active';
    await product.save();

    await logAudit(
      'Approved Product',
      'Product',
      req.user._id,
      req.ownerId,
      product._id,
      `Approved product request for ${product.name}`
    );

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private / Admin
const updateProduct = async (req, res) => {
  try {
    const { name, category, unit, price, gst, barcode, stock, costPrice, lowStockThreshold } = req.body;
    const product = await Product.findOne({ _id: req.params.id, user: req.ownerId });

    if (product) {
      product.name = name || product.name;
      product.category = category !== undefined ? category : product.category;
      product.unit = unit !== undefined ? unit : product.unit;
      product.price = price !== undefined ? price : product.price;
      product.gst = gst !== undefined ? gst : product.gst;
      if (barcode !== undefined) product.barcode = barcode === "" ? undefined : barcode;
      product.stock = stock !== undefined ? stock : product.stock;
      product.costPrice = costPrice !== undefined ? costPrice : product.costPrice;
      product.lowStockThreshold = lowStockThreshold !== undefined ? lowStockThreshold : product.lowStockThreshold;

      const updatedProduct = await product.save();

      await logAudit(
        'Updated Product',
        'Product',
        req.user._id,
        req.ownerId,
        product._id,
        `Updated details for ${name}`
      );

      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private / Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, user: req.ownerId });
    if (product) {
      const productName = product.name;
      await product.deleteOne();

      await logAudit(
        'Deleted Product',
        'Product',
        req.user._id,
        req.ownerId,
        req.params.id,
        `Removed product ${productName} from inventory`
      );

      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getProducts, getProductByBarcode, createProduct, approveProduct, updateProduct, deleteProduct };
