const AuditLog = require("../models/AuditLog");

const writeAudit = (userId, action, module, description, referenceId, newData, session) =>
    AuditLog.create(
        [{ userId, action, module, description, referenceId: referenceId || null, newData: newData || null }],
        session ? { session } : undefined
    ).then(([entry]) => entry);

module.exports = writeAudit;