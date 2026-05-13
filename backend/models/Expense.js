const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  category: {
    type: String,
    enum: ['Rent', 'Electricity', 'Salary', 'Transport', 'Purchase', 'Maintenance', 'Marketing', 'Other'],
    default: 'Other'
  },
  paymentMethod: { type: String, enum: ['Cash', 'UPI', 'Bank Transfer', 'Card'], default: 'Cash' },
  note: { type: String },
  date: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
