const mongoose = require('mongoose');

const customerRequestSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  type: { type: String, enum: ['edit', 'delete'], required: true },
  proposedData: {
    name: String,
    mobile: String,
    email: String,
    address: String
  },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }  // shop owner
}, { timestamps: true });

const CustomerRequest = mongoose.model('CustomerRequest', customerRequestSchema);
module.exports = CustomerRequest;
