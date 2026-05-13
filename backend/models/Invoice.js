const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  products: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    returnedQty: { type: Number, default: 0 },
    price: { type: Number, required: true },
    gst: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true }
  }],
  subTotal: { type: Number, required: true },
  totalDiscount: { type: Number, default: 0 },
  totalGst: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  status: { type: String, enum: ['Paid', 'Unpaid', 'Partial', 'Cancelled'], default: 'Unpaid' },
  payments: [{
    amount: { type: Number, required: true },
    method: { type: String, enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'], default: 'Cash' },
    note: { type: String },
    paidAt: { type: Date, default: Date.now }
  }],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const Invoice = mongoose.model('Invoice', invoiceSchema);
module.exports = Invoice;
