const Asset = require("../models/Assets");
const Base = require("../models/Bases");
const Inventory = require("../models/Inventory");
const Purchase = require("../models/Purchase");
const Transfer = require("../models/Transfer");
const Assignment = require("../models/Assignment");
const Expenditure = require("../models/Expenditure");
const writeAudit = require("../utils/audit");
const { AppError } = require("../utils/errors");
const { requireBase, scopeQuery } = require("../utils/scope");
const withTransaction = require("../utils/transaction");

const parseDate = (value, label) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new AppError(`${label} must be a valid date`);
    if (label === "endDate" && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
    return date;
};

const quantityFrom = (value) => {
    const quantity = Number(value);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new AppError("Quantity must be a positive whole number");
    }
    return quantity;
};

const requestedAssets = async (type) => {
    if (!type) return undefined;
    const assets = await Asset.find({ type }).select("_id").lean();
    return assets.map(({ _id }) => _id);
};

const listByFilters = async (req, res, Model, dateField, baseField = "baseId") => {
    const filter = { ...scopeQuery(req.user, baseField) };
    const startDate = parseDate(req.query.startDate, "startDate");
    const endDate = parseDate(req.query.endDate, "endDate");
    const dateFilter = {};
    if (startDate) dateFilter.$gte = startDate;
    if (endDate) dateFilter.$lte = endDate;
    if (Object.keys(dateFilter).length) filter[dateField] = dateFilter;
    if (req.user.role === "Admin" && req.query.baseId) filter[baseField] = req.query.baseId;
    const ids = await requestedAssets(req.query.type);
    if (ids) filter.assetId = { $in: ids };
    return Model.find(filter)
        .populate("assetId", "name type unit")
        .populate(baseField, "name location")
        .sort({ [dateField]: -1 })
        .limit(250)
        .lean();
};

const addStock = async (assetId, baseId, quantity, session) => Inventory.findOneAndUpdate(
    { assetId, baseId },
    {
        $inc: { currentStock: quantity },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { assetId, baseId, openingBalance: 0 }
    },
    { upsert: true, new: true, runValidators: true, session }
);

const removeStock = async (assetId, baseId, quantity, session) => {
    const inventory = await Inventory.findOneAndUpdate(
        { assetId, baseId, currentStock: { $gte: quantity } },
        { $inc: { currentStock: -quantity }, $set: { lastUpdated: new Date() } },
        { new: true, runValidators: true, session }
    );
    if (!inventory) throw new AppError("Insufficient stock at the selected base", 409);
    return inventory;
};

const requireAsset = async (assetId) => {
    if (!assetId || !(await Asset.exists({ _id: assetId }))) throw new AppError("Asset not found", 404);
};

const createPurchase = async (req, res) => {
    const { assetId, supplier = "", remarks = "" } = req.body;
    const baseId = requireBase(req.user, req.body.baseId);
    const quantity = quantityFrom(req.body.quantity);
    await requireAsset(assetId);
    const purchaseDate = parseDate(req.body.purchaseDate, "purchaseDate") || new Date();
    const purchase = await withTransaction(async (session) => {
        const [record] = await Purchase.create([{
            assetId, baseId, quantity, purchaseDate, supplier, remarks, addedBy: req.user._id
        }], { session });
        await addStock(assetId, baseId, quantity, session);
        await writeAudit(req.user._id, "CREATE", "Purchase", `Received ${quantity} units at a base`, record._id, record.toObject(), session);
        return record;
    });
    res.status(201).json({ purchase });
};

const listPurchases = async (req, res) =>
    res.json({ purchases: await listByFilters(req, res, Purchase, "purchaseDate") });

const createTransfer = async (req, res) => {
    const { assetId, toBaseId, remarks = "" } = req.body;
    const fromBaseId = requireBase(req.user, req.body.fromBaseId);
    const quantity = quantityFrom(req.body.quantity);
    if (String(fromBaseId) === String(toBaseId)) throw new AppError("Choose two different bases");
    if (!toBaseId || !(await Base.exists({ _id: toBaseId }))) throw new AppError("Destination base not found", 404);
    await requireAsset(assetId);
    const transferDate = parseDate(req.body.transferDate, "transferDate") || new Date();
    const transfer = await withTransaction(async (session) => {
        await removeStock(assetId, fromBaseId, quantity, session);
        await addStock(assetId, toBaseId, quantity, session);
        const [record] = await Transfer.create([{
            assetId, fromBaseId, toBaseId, quantity, transferDate, remarks, initiatedBy: req.user._id
        }], { session });
        await writeAudit(req.user._id, "CREATE", "Transfer", `Transferred ${quantity} units between bases`, record._id, record.toObject(), session);
        return record;
    });
    res.status(201).json({ transfer });
};

const listTransfers = async (req, res) => {
    const filter = {};
    if (req.user.role === "Admin") {
        if (req.query.baseId) filter.$or = [{ fromBaseId: req.query.baseId }, { toBaseId: req.query.baseId }];
    } else {
        filter.$or = [{ fromBaseId: req.user.baseId }, { toBaseId: req.user.baseId }];
    }
    const dateFilter = {};
    const startDate = parseDate(req.query.startDate, "startDate");
    const endDate = parseDate(req.query.endDate, "endDate");
    if (startDate) dateFilter.$gte = startDate;
    if (endDate) dateFilter.$lte = endDate;
    if (Object.keys(dateFilter).length) filter.transferDate = dateFilter;
    const assetIds = await requestedAssets(req.query.type);
    if (assetIds) filter.assetId = { $in: assetIds };
    const transfers = await Transfer.find(filter)
        .populate("assetId", "name type unit")
        .populate("fromBaseId", "name location")
        .populate("toBaseId", "name location")
        .sort({ transferDate: -1 })
        .limit(250)
        .lean();
    res.json({ transfers });
};

const createAssignment = async (req, res) => {
    const { assetId, assignedTo, remarks = "" } = req.body;
    const baseId = requireBase(req.user, req.body.baseId);
    const quantity = quantityFrom(req.body.quantity);
    if (!String(assignedTo || "").trim()) throw new AppError("The recipient is required");
    await requireAsset(assetId);
    const assignmentDate = parseDate(req.body.assignmentDate, "assignmentDate") || new Date();
    const assignment = await withTransaction(async (session) => {
        await removeStock(assetId, baseId, quantity, session);
        const [record] = await Assignment.create([{
            assetId, baseId, quantity, assignedTo, remarks, assignmentDate, assignedBy: req.user._id
        }], { session });
        await writeAudit(req.user._id, "CREATE", "Assignment", `Issued ${quantity} units to ${assignedTo}`, record._id, record.toObject(), session);
        return record;
    });
    res.status(201).json({ assignment });
};

const listAssignments = async (req, res) =>
    res.json({ assignments: await listByFilters(req, res, Assignment, "assignmentDate") });

const createExpenditure = async (req, res) => {
    const { assetId, reason, remarks = "" } = req.body;
    const baseId = requireBase(req.user, req.body.baseId);
    const quantity = quantityFrom(req.body.quantity);
    await requireAsset(assetId);
    const expenditureDate = parseDate(req.body.expenditureDate, "expenditureDate") || new Date();
    const expenditure = await withTransaction(async (session) => {
        await removeStock(assetId, baseId, quantity, session);
        const [record] = await Expenditure.create([{
            assetId, baseId, quantity, reason, remarks, expenditureDate, expendedBy: req.user._id
        }], { session });
        await writeAudit(req.user._id, "CREATE", "Expenditure", `Recorded ${quantity} units as ${reason}`, record._id, record.toObject(), session);
        return record;
    });
    res.status(201).json({ expenditure });
};

const listExpenditures = async (req, res) =>
    res.json({ expenditures: await listByFilters(req, res, Expenditure, "expenditureDate") });

const listAuditLogs = async (req, res) => {
    const filter = {};
    if (req.user.role !== "Admin") filter.userId = req.user._id;
    if (req.query.module) filter.module = req.query.module;
    const logs = await require("../models/AuditLog")
        .find(filter)
        .populate("userId", "name email role")
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();
    res.json({ auditLogs: logs });
};

module.exports = {
    createPurchase, listPurchases, createTransfer, listTransfers,
    createAssignment, listAssignments, createExpenditure, listExpenditures, listAuditLogs
};