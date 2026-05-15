const express = require('express');
const router = express.Router();
const { createQuotation, getQuotations, deleteQuotation } = require('../controllers/quotationController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .post(protect, createQuotation)
  .get(protect, getQuotations);

router.route('/:id')
  .delete(protect, deleteQuotation);

module.exports = router;
