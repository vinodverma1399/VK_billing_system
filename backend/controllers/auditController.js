const AuditLog = require('../models/AuditLog');

// Internal Helper to create logs from anywhere in backend
const logAudit = async (action, entity, user, ownerId, entityId = null, details = '') => {
  try {
    await AuditLog.create({ action, entity, user, ownerId, entityId, details });
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
};

// @desc    Get all audit logs for a shop
// @route   GET /api/audit
// @access  Private / Admin
const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find({ ownerId: req.ownerId })
      .populate('user', 'name role')
      .sort({ createdAt: -1 })
      .limit(200); // Last 200 actions
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { logAudit, getAuditLogs };
