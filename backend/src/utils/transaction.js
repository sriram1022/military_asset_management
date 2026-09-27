const mongoose = require("mongoose");

const withTransaction = async (handler) => {
    const session = await mongoose.startSession();
    let result;
    try {
        await session.withTransaction(async () => {
            result = await handler(session);
        });
    } finally {
        await session.endSession();
    }
    return result;
};

module.exports = withTransaction;