const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
  quotationNumber: { type: String, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: String,
  customerMobile: String,
  products: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    price: Number,
    gst: Number,
    total: Number,
    discount: Number
  }],
  subTotal: { type: Number, required: true },
  totalDiscount: { type: Number, default: 0 },
  totalGst: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  status: { type: String, default: 'Estimate' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Quotation', quotationSchema);
