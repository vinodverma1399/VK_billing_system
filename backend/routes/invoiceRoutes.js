const express = require('express');
const router = express.Router();
const { createInvoice, getInvoices, getShopInvoices, cancelInvoice, updateInvoiceStatus, updateInvoice, addPayment } = require('../controllers/invoiceController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/').get(protect, getInvoices).post(protect, createInvoice);
router.get('/shop-all', protect, getShopInvoices);   // All shop invoices — for return lookup
router.put('/:id', protect, updateInvoice);
router.put('/:id/cancel', protect, admin, cancelInvoice);
router.put('/:id/status', protect, admin, updateInvoiceStatus);
router.post('/:id/payments', protect, addPayment);

module.exports = router;
