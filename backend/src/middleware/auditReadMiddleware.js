const writeAudit = require("../utils/audit");
const { asyncHandler } = require("../utils/errors");

const auditRead = (moduleName) => asyncHandler(async (req, res, next) => {
    await writeAudit(req.user._id, "READ", moduleName, `Requested ${moduleName.toLowerCase()}`);
    next();
});

module.exports = auditRead;