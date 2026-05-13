const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/').get(protect, admin, getAuditLogs);

module.exports = router;
