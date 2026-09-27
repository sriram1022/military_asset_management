const express = require("express");
const protect = require("../middleware/authMiddleware");
const { authorize } = protect;
const { asyncHandler } = require("../utils/errors");
const auditRead = require("../middleware/auditReadMiddleware");
const {
    createPurchase, listPurchases, createTransfer, listTransfers,
    createAssignment, listAssignments, createExpenditure, listExpenditures, listAuditLogs
} = require("../controllers/operationsController");

const router = express.Router();
router.use(protect);
router.get("/purchases", auditRead("Purchases"), asyncHandler(listPurchases));
router.post("/purchases", authorize("Admin", "BaseCommander", "LogisticsOfficer"), asyncHandler(createPurchase));
router.get("/transfers", auditRead("Transfers"), asyncHandler(listTransfers));
router.post("/transfers", authorize("Admin", "BaseCommander", "LogisticsOfficer"), asyncHandler(createTransfer));
router.get("/assignments", auditRead("Assignments"), authorize("Admin", "BaseCommander"), asyncHandler(listAssignments));
router.post("/assignments", authorize("Admin", "BaseCommander"), asyncHandler(createAssignment));
router.get("/expenditures", auditRead("Expenditures"), authorize("Admin", "BaseCommander"), asyncHandler(listExpenditures));
router.post("/expenditures", authorize("Admin", "BaseCommander"), asyncHandler(createExpenditure));
router.get("/audit-logs", auditRead("Audit logs"), authorize("Admin"), asyncHandler(listAuditLogs));

module.exports = router;