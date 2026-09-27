const Inventory = require("../models/Inventory");
const Purchase = require("../models/Purchase");
const Transfer = require("../models/Transfer");
const Assignment = require("../models/Assignment");
const Expenditure = require("../models/Expenditure");
const Asset = require("../models/Assets");
const { AppError } = require("../utils/errors");

const validDate = (value, label) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new AppError(`${label} must be a valid date`);
    if (label === "endDate" && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
    return date;
};

const sum = (rows, selector) => rows.reduce((total, row) => total + selector(row), 0);

const getDashboard = async (req, res) => {
    const now = new Date();
    const startDate = validDate(req.query.startDate, "startDate") || new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = validDate(req.query.endDate, "endDate") || now;
    if (startDate > endDate) throw new AppError("startDate must be on or before endDate");

    const assetFilter = req.query.type ? { type: req.query.type } : {};
    const assets = await Asset.find(assetFilter).select("_id").lean();
    const assetIds = assets.map(({ _id }) => _id);
    const baseIds = req.user.role === "Admin"
        ? req.query.baseId ? [req.query.baseId] : null
        : [req.user.baseId];
    if (!req.user.baseId && req.user.role !== "Admin") throw new AppError("Your account is not assigned to a base", 403);

    const isLogisticsOfficer = req.user.role === "LogisticsOfficer";
    const inventoryFilter = { assetId: { $in: assetIds } };
    if (baseIds) inventoryFilter.baseId = { $in: baseIds };
    const inventory = isLogisticsOfficer
        ? []
        : await Inventory.find(inventoryFilter).select("assetId baseId openingBalance").lean();
    const selectedBases = new Set(inventory.map((row) => String(row.baseId)));
    const locationMatch = (baseId) => !baseIds || baseIds.some((id) => String(id) === String(baseId));
    const range = { $lte: endDate };

    const [purchases, transfers, assignments, expenditures] = await Promise.all([
        Purchase.find({ assetId: { $in: assetIds }, purchaseDate: range }).select("baseId quantity purchaseDate").lean(),
        Transfer.find({ assetId: { $in: assetIds }, transferDate: range }).select("fromBaseId toBaseId quantity transferDate").lean(),
        isLogisticsOfficer ? Promise.resolve([]) : Assignment.find({ assetId: { $in: assetIds }, assignmentDate: range }).select("baseId quantity assignmentDate").lean(),
        isLogisticsOfficer ? Promise.resolve([]) : Expenditure.find({ assetId: { $in: assetIds }, expenditureDate: range }).select("baseId quantity expenditureDate").lean()
    ]);

    const opening = sum(inventory, (row) => row.openingBalance);
    const beforeStart = (date) => date < startDate;
    const inPeriod = (date) => date >= startDate && date <= endDate;
    const purchaseChange = (row) => locationMatch(row.baseId) ? row.quantity : 0;
    const transferInChange = (row) => locationMatch(row.toBaseId) ? row.quantity : 0;
    const transferOutChange = (row) => locationMatch(row.fromBaseId) ? row.quantity : 0;
    const assignmentChange = (row) => locationMatch(row.baseId) ? row.quantity : 0;
    const expenditureChange = (row) => locationMatch(row.baseId) ? row.quantity : 0;

    const openingBalance = opening
        + sum(purchases.filter((row) => beforeStart(row.purchaseDate)), purchaseChange)
        + sum(transfers.filter((row) => beforeStart(row.transferDate)), transferInChange)
        - sum(transfers.filter((row) => beforeStart(row.transferDate)), transferOutChange)
        - sum(assignments.filter((row) => beforeStart(row.assignmentDate)), assignmentChange)
        - sum(expenditures.filter((row) => beforeStart(row.expenditureDate)), expenditureChange);

    const periodPurchases = purchases.filter((row) => inPeriod(row.purchaseDate) && locationMatch(row.baseId));
    const periodTransfersIn = transfers.filter((row) => inPeriod(row.transferDate) && locationMatch(row.toBaseId));
    const periodTransfersOut = transfers.filter((row) => inPeriod(row.transferDate) && locationMatch(row.fromBaseId));
    const assigned = sum(assignments.filter((row) => inPeriod(row.assignmentDate)), assignmentChange);
    const expended = sum(expenditures.filter((row) => inPeriod(row.expenditureDate)), expenditureChange);
    const netMovement = sum(periodPurchases, (row) => row.quantity)
        + sum(periodTransfersIn, (row) => row.quantity)
        - sum(periodTransfersOut, (row) => row.quantity);

    const metrics = isLogisticsOfficer
        ? { netMovement }
        : {
            openingBalance,
            closingBalance: openingBalance + netMovement - assigned - expended,
            netMovement,
            assigned,
            expended
        };

    res.json({
        period: { startDate, endDate },
        metrics,
        movement: {
            purchases: sum(periodPurchases, (row) => row.quantity),
            transfersIn: sum(periodTransfersIn, (row) => row.quantity),
            transfersOut: sum(periodTransfersOut, (row) => row.quantity),
            ...(!isLogisticsOfficer ? { selectedBaseCount: baseIds ? selectedBases.size : null } : {})
        }
    });
};

module.exports = { getDashboard };