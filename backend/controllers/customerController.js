const Customer = require('../models/Customer');
const CustomerRequest = require('../models/CustomerRequest');

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ user: req.ownerId });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get customer by mobile
// @route   GET /api/customers/mobile/:mobile
// @access  Private
const getCustomerByMobile = async (req, res) => {
  try {
    const customer = await Customer.findOne({ mobile: req.params.mobile, user: req.ownerId });
    if (customer) {
      res.json(customer);
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
  try {
    const { mobile, name, email, address } = req.body;
    const customerExists = await Customer.findOne({ mobile, user: req.ownerId });
    if (customerExists) {
      return res.status(400).json({ message: 'Customer with this mobile already exists' });
    }
    const customer = await Customer.create({ mobile, name, email, address, user: req.ownerId });
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update customer (Admin only)
// @route   PUT /api/customers/:id
// @access  Private / Admin
const updateCustomer = async (req, res) => {
  try {
    const { name, email, address, mobile } = req.body;
    const customer = await Customer.findOne({ _id: req.params.id, user: req.ownerId });
    if (customer) {
      customer.name = name || customer.name;
      customer.email = email || customer.email;
      customer.address = address || customer.address;
      customer.mobile = mobile || customer.mobile;
      const updatedCustomer = await customer.save();
      res.json(updatedCustomer);
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete customer (Admin only)
// @route   DELETE /api/customers/:id
// @access  Private / Admin
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, user: req.ownerId });
    if (customer) {
      await customer.deleteOne();
      res.json({ message: 'Customer removed' });
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Change Requests (Staff) ─────────────────────────────────────────────

// @desc    Staff submits an edit or delete request for a customer
// @route   POST /api/customers/requests
// @access  Private
const createChangeRequest = async (req, res) => {
  try {
    const { customerId, type, proposedData } = req.body;
    if (!customerId || !type) return res.status(400).json({ message: 'customerId and type required' });

    const customer = await Customer.findOne({ _id: customerId, user: req.ownerId });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    // Check if there is already a pending request for this customer
    const existing = await CustomerRequest.findOne({ customer: customerId, status: 'pending' });
    if (existing) return res.status(400).json({ message: 'A pending request already exists for this customer' });

    const request = await CustomerRequest.create({
      customer: customerId,
      type,
      proposedData: type === 'edit' ? proposedData : {},
      requestedBy: req.user._id,
      user: req.ownerId
    });

    await request.populate('customer', 'name mobile');
    await request.populate('requestedBy', 'name');
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all pending customer change requests (Admin)
// @route   GET /api/customers/requests
// @access  Private
const getChangeRequests = async (req, res) => {
  try {
    const requests = await CustomerRequest.find({ user: req.ownerId, status: 'pending' })
      .populate('customer', 'name mobile email address')
      .populate('requestedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin approves or rejects a customer change request
// @route   PUT /api/customers/requests/:id
// @access  Private / Admin
const handleChangeRequest = async (req, res) => {
  try {
    const { action } = req.body; // 'approve' | 'reject'
    const request = await CustomerRequest.findOne({ _id: req.params.id, user: req.ownerId })
      .populate('customer');

    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: 'Request already handled' });

    if (action === 'approve') {
      if (request.type === 'edit' && request.customer) {
        const customer = request.customer;
        if (request.proposedData.name) customer.name = request.proposedData.name;
        if (request.proposedData.mobile) customer.mobile = request.proposedData.mobile;
        if (request.proposedData.email) customer.email = request.proposedData.email;
        if (request.proposedData.address) customer.address = request.proposedData.address;
        await customer.save();
      } else if (request.type === 'delete' && request.customer) {
        await request.customer.deleteOne();
      }
      request.status = 'approved';
    } else {
      request.status = 'rejected';
    }

    await request.save();
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCustomers, getCustomerByMobile, createCustomer,
  updateCustomer, deleteCustomer,
  createChangeRequest, getChangeRequests, handleChangeRequest
};
