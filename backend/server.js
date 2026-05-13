const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Attach io to req object so controllers can use it
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');

// Basic Route
app.get('/', (req, res) => {
  res.send('Smart Billing API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/returns', require('./routes/returnRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));

// Database connection
const connectDB = async () => {
  try {
    const useDummy = process.env.USE_DUMMY_DB === 'true';

    if (useDummy || !process.env.MONGO_URI) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log('🚀 Running in DUMMY MODE (In-Memory Database)');
      console.log('Note: Data will be lost when server restarts.');
    } else {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ Connected to MongoDB Atlas');
    }
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);

    // Automatic Fallback to Memory Server if Atlas fails
    try {
      console.log('🔄 Attempting fallback to In-Memory Database...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
      console.log('🚀 Fallback Successful: Running in DUMMY MODE');
    } catch (fallbackErr) {
      console.error('Critical Error: Could not start even dummy database', fallbackErr);
      process.exit(1);
    }
  }
};

connectDB();

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
