const express = require('express');
const router = express.Router();
const { getCategories, createCategory, deleteCategory } = require('../controllers/categoryController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/').get(protect, getCategories).post(protect, admin, createCategory);
router.route('/:id').delete(protect, admin, deleteCategory);

module.exports = router;
