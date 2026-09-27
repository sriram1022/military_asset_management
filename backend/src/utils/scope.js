const { AppError } = require("./errors");

const requireBase = (user, requestedBaseId) => {
    if (user.role === "Admin") {
        if (!requestedBaseId) throw new AppError("baseId is required");
        return requestedBaseId;
    }
    if (!user.baseId) throw new AppError("Your account is not assigned to a base", 403);
    if (requestedBaseId && String(requestedBaseId) !== String(user.baseId)) {
        throw new AppError("You can only access your assigned base", 403);
    }
    return user.baseId;
};

const scopeQuery = (user, field = "baseId") =>
    user.role === "Admin" ? {} : { [field]: user.baseId };

module.exports = { requireBase, scopeQuery };