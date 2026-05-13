require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const res = await User.updateMany({}, { role: 'Admin' });
  console.log('Updated users to Admin:', res.modifiedCount);
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
