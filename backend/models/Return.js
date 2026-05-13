const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema({
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  returnedProducts: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    refundAmount: { type: Number, required: true },
    condition: { type: String, enum: ['Good', 'Defective'], default: 'Good' }
  }],
  totalRefund: { type: Number, required: true },
  reason: { type: String, default: 'Customer Return' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const Return = mongoose.model('Return', returnSchema);
module.exports = Return;
