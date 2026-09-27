const express = require("express");
const protect = require("../middleware/authMiddleware");
const { authorize } = protect;
const { asyncHandler } = require("../utils/errors");
const auditRead = require("../middleware/auditReadMiddleware");
const {
    listBases, createBase, listAssets, createAsset, listInventory, addOpeningBalance
} = require("../controllers/resourceController");

const router = express.Router();
router.use(protect);
router.get("/bases", auditRead("Bases"), asyncHandler(listBases));
router.post("/bases", authorize("Admin"), asyncHandler(createBase));
router.get("/assets", auditRead("Assets"), asyncHandler(listAssets));
router.post("/assets", authorize("Admin"), asyncHandler(createAsset));
router.get("/inventory", auditRead("Inventory"), authorize("Admin", "BaseCommander"), asyncHandler(listInventory));
router.post("/inventory/opening-balance", authorize("Admin", "BaseCommander"), asyncHandler(addOpeningBalance));

module.exports = router;