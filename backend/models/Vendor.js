const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  gst: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const Vendor = mongoose.model('Vendor', vendorSchema);
module.exports = Vendor;
