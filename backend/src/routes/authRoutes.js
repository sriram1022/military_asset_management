const express = require("express");
const protect = require("../middleware/authMiddleware");
const { authorize } = protect;
const { asyncHandler } = require("../utils/errors");
const auditRead = require("../middleware/auditReadMiddleware");
const { login, createUser, listUsers, me } = require("../controllers/authController");

const router = express.Router();
router.post("/login", asyncHandler(login));
router.get("/me", protect, auditRead("Authentication"), asyncHandler(me));
router.get("/users", protect, auditRead("Users"), authorize("Admin"), asyncHandler(listUsers));
router.post("/users", protect, authorize("Admin"), asyncHandler(createUser));

module.exports = router;