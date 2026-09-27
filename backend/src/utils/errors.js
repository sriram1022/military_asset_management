class AppError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const asyncHandler = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const handleError = (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || (error.name === "ValidationError" ? 400 : 500);
    const message = error.code === 11000 ? "A record with those details already exists" : error.message;
    if (status >= 500) console.error(error);
    res.status(status).json({ message });
};

module.exports = { AppError, asyncHandler, handleError };