const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., 'Created Invoice', 'Deleted Customer'
  entity: { type: String, required: true }, // e.g., 'Invoice', 'Customer', 'Auth'
  entityId: { type: mongoose.Schema.Types.ObjectId }, // Optional, id of the affected doc
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who did it
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Shop owner
  details: { type: String } // Additional text
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
