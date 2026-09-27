const express = require("express");
const protect = require("../middleware/authMiddleware");
const { asyncHandler } = require("../utils/errors");
const auditRead = require("../middleware/auditReadMiddleware");
const { getDashboard } = require("../controllers/dashboardController");

const router = express.Router();
router.get("/", protect, auditRead("Dashboard"), asyncHandler(getDashboard));

module.exports = router;