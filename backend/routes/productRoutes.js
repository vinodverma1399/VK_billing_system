const express = require('express');
const router = express.Router();
const { getProducts, getProductByBarcode, createProduct, approveProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { protect, admin } = require('../middlewares/authMiddleware');

// Staff can view & create (pending); Admin can do everything
router.route('/').get(protect, getProducts).post(protect, createProduct);
router.route('/:id').put(protect, admin, updateProduct).delete(protect, admin, deleteProduct);
router.put('/:id/approve', protect, admin, approveProduct);
router.route('/barcode/:barcode').get(protect, getProductByBarcode);

module.exports = router;
