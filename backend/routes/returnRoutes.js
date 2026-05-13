const express = require('express');
const router = express.Router();
const { getReturns, createReturn, updateReturnStatus } = require('../controllers/returnController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/').get(protect, getReturns).post(protect, createReturn);
router.put('/:id/status', protect, admin, updateReturnStatus);

module.exports = router;
