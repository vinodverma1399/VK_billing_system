const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  mobile: { type: String, required: true },
  name: { type: String },
  email: { type: String },
  address: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const Customer = mongoose.model('Customer', customerSchema);
module.exports = Customer;
