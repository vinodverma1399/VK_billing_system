const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('./models/User');

require('dotenv').config();

const testAPI = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    let user = await User.findOne({});
    if (!user) {
      console.log('No user found to generate token.');
      process.exit(1);
    }
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    console.log('Generated token');
    
    const config = { headers: { Authorization: `Bearer ${token}` } };
    
    try {
      const res = await axios.get('http://localhost:5000/api/reports/sales?type=daily', config);
      console.log('Sales Data:', JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.error('API Error:', err.response ? err.response.data : err.message);
    }
    
    try {
      const res2 = await axios.get('http://localhost:5000/api/reports/invoice-status', config);
      console.log('Invoice Status:', JSON.stringify(res2.data, null, 2));
    } catch (err) {
      console.error('API Error 2:', err.response ? err.response.data : err.message);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

testAPI();
