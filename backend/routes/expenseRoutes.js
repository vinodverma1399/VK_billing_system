const express = require('express');
const router = express.Router();
const { getExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/').get(protect, admin, getExpenses).post(protect, admin, createExpense);
router.route('/:id').put(protect, admin, updateExpense).delete(protect, admin, deleteExpense);

module.exports = router;
