const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getSalesReport,
  getVendorPurchasesReport,
  getInvoiceStatusReport,
  getGstReport,
  getPLReport
} = require('../controllers/reportController');

router.route('/sales').get(protect, getSalesReport);
router.route('/vendor-purchases').get(protect, getVendorPurchasesReport);
router.route('/invoice-status').get(protect, getInvoiceStatusReport);
router.route('/gst').get(protect, getGstReport);
router.route('/pl').get(protect, getPLReport);

module.exports = router;
