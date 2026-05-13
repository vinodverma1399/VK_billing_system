const express = require('express');
const router = express.Router();
const {
  getCustomers, getCustomerByMobile, createCustomer,
  updateCustomer, deleteCustomer,
  createChangeRequest, getChangeRequests, handleChangeRequest
} = require('../controllers/customerController');
const { protect, admin } = require('../middlewares/authMiddleware');

// Change-request routes (MUST be before /:id routes)
router.route('/requests')
  .get(protect, getChangeRequests)          // Admin sees all pending requests
  .post(protect, createChangeRequest);      // Staff submits a request

router.put('/requests/:id', protect, admin, handleChangeRequest); // Admin approves/rejects

// Customer CRUD
router.route('/').get(protect, getCustomers).post(protect, createCustomer);
router.route('/:id')
  .put(protect, admin, updateCustomer)      // Admin only
  .delete(protect, admin, deleteCustomer);  // Admin only
router.route('/mobile/:mobile').get(protect, getCustomerByMobile);

module.exports = router;
