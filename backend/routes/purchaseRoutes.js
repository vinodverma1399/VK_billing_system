const express = require('express');
const router = express.Router();
const { getPurchases, createPurchase, updatePurchaseStatus } = require('../controllers/purchaseController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/').get(protect, getPurchases).post(protect, createPurchase);
router.route('/:id/pay').put(protect, updatePurchaseStatus);

module.exports = router;
