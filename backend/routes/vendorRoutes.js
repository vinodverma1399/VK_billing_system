const express = require('express');
const router = express.Router();
const { getVendors, createVendor, updateVendor, deleteVendor } = require('../controllers/vendorController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/').get(protect, getVendors).post(protect, admin, createVendor);
router.route('/:id').put(protect, admin, updateVendor).delete(protect, admin, deleteVendor);

module.exports = router;
