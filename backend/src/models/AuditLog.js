const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: ["CREATE", "READ", "UPDATE", "DELETE", "LOGIN"], required: true },
    module: { type: String, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    description: { type: String, required: true },
    oldData: { type: mongoose.Schema.Types.Mixed, default: null },
    newData: { type: mongoose.Schema.Types.Mixed, default: null },
    timestamp: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("AuditLog", auditLogSchema);