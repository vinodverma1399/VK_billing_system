const mongoose = require('mongoose');

const uri = "mongodb://vinodverma2555_bill:VinodBilling2555@ac-pkeseb6-shard-00-00.gfsqi5o.mongodb.net:27017,ac-pkeseb6-shard-00-01.gfsqi5o.mongodb.net:27017,ac-pkeseb6-shard-00-02.gfsqi5o.mongodb.net:27017/vk_billing?replicaSet=atlas-2ygti7-shard-0&authSource=admin&tls=true&retryWrites=true&w=majority";

const testConnection = async () => {
  try {
    console.log('Connecting to', uri);
    await mongoose.connect(uri);
    console.log('✅ Connection Successful!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection Failed:', error.message);
    process.exit(1);
  }
};

testConnection();
