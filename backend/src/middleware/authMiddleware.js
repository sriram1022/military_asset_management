const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "A bearer token is required" });
  }

  try {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("name email role baseId").lean();
    if (!user) return res.status(401).json({ message: "Account no longer exists" });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Your role cannot perform this action" });
  }
  next();
};

module.exports = protect;
module.exports.authorize = authorize;