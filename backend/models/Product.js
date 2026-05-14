const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String },
  unit: { type: String, default: 'Piece' },
  price: { type: Number, required: true },
  gst: { type: Number, default: 0 },
  barcode: { type: String, sparse: true },
  stock: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 5 },
  status: { type: String, enum: ['active', 'pending'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
