const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  products: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    purchasePrice: { type: Number, required: true },
    total: { type: Number, required: true }
  }],
  totalCost: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
  payments: [{
    amount: { type: Number, required: true },
    method: { type: String, enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'], default: 'Cash' },
    note: { type: String },
    paidAt: { type: Date, default: Date.now }
  }],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purchaseDate: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const Purchase = mongoose.model('Purchase', purchaseSchema);
module.exports = Purchase;
