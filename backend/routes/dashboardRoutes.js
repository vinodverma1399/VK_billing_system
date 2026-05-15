const express = require('express');
const router = express.Router();
const { getMetrics, getBestSellers } = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/metrics', protect, getMetrics);
router.get('/best-sellers', protect, getBestSellers);

module.exports = router;
