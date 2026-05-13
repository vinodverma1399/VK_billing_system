const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Staff'], default: 'Admin' },
  shopName: { type: String },
  shopAddress: { type: String },
  shopPhone: { type: String },
  shopGst: { type: String },
  upiId: { type: String },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resetOtp: { type: String },
  resetOtpExpires: { type: Date }
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
