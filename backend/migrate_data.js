const mongoose = require('mongoose');
require('dotenv').config();

const updateMissingUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const User = require('./models/User');
    const Product = require('./models/Product');
    const Customer = require('./models/Customer');
    const Vendor = require('./models/Vendor');
    const Invoice = require('./models/Invoice');
    const Purchase = require('./models/Purchase');

    // Find first user (likely VK)
    const vkUser = await User.findOne({ email: 'vinodverma2555@gmail.com' }) || await User.findOne({});
    if (!vkUser) {
      console.log('No user found to assign existing records to.');
      process.exit(1);
    }
    const userId = vkUser._id;
    console.log('Assigning existing records to user:', vkUser.email, userId);

    const updateOpts = { user: userId };
    
    const pRes = await Product.updateMany({ user: { $exists: false } }, { $set: updateOpts });
    console.log('Products updated:', pRes.modifiedCount);

    const cRes = await Customer.updateMany({ user: { $exists: false } }, { $set: updateOpts });
    console.log('Customers updated:', cRes.modifiedCount);

    const vRes = await Vendor.updateMany({ user: { $exists: false } }, { $set: updateOpts });
    console.log('Vendors updated:', vRes.modifiedCount);

    const iRes = await Invoice.updateMany({ user: { $exists: false } }, { $set: updateOpts });
    console.log('Invoices updated:', iRes.modifiedCount);

    const purRes = await Purchase.updateMany({ user: { $exists: false } }, { $set: updateOpts });
    console.log('Purchases updated:', purRes.modifiedCount);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

updateMissingUser();
