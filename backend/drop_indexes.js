const mongoose = require('mongoose');
require('dotenv').config();

const dropIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const Customer = require('./models/Customer');
    const Vendor = require('./models/Vendor');
    const Product = require('./models/Product');

    try {
      await Customer.collection.dropIndex('mobile_1');
      console.log('Dropped mobile_1 index from customers');
    } catch (e) {
      console.log('mobile_1 index not found in customers or already dropped');
    }

    try {
      await Vendor.collection.dropIndex('mobile_1');
      console.log('Dropped mobile_1 index from vendors');
    } catch (e) {
      console.log('mobile_1 index not found in vendors or already dropped');
    }

    try {
      await Product.collection.dropIndex('barcode_1');
      console.log('Dropped barcode_1 index from products');
    } catch (e) {
      console.log('barcode_1 index not found in products or already dropped');
    }

    // Optionally recreate compound indexes
    await Customer.collection.createIndex({ mobile: 1, user: 1 }, { unique: true });
    console.log('Created compound index { mobile: 1, user: 1 } for customers');

    await Vendor.collection.createIndex({ mobile: 1, user: 1 }, { unique: true });
    console.log('Created compound index { mobile: 1, user: 1 } for vendors');

    await Product.collection.createIndex({ barcode: 1, user: 1 }, { unique: true, sparse: true });
    console.log('Created compound index { barcode: 1, user: 1 } for products');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

dropIndexes();
