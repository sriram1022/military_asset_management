const Asset = require("../models/Assets");
const Base = require("../models/Bases");
const Inventory = require("../models/Inventory");
const writeAudit = require("../utils/audit");
const { AppError } = require("../utils/errors");
const { scopeQuery, requireBase } = require("../utils/scope");
const withTransaction = require("../utils/transaction");

const listBases = async (req, res) => {
    res.json({ bases: await Base.find().sort({ name: 1 }).lean() });
};

const createBase = async (req, res) => {
    if (!req.body.name || !req.body.location) throw new AppError("Base name and location are required");
    const base = await withTransaction(async (session) => {
        const [record] = await Base.create([{ name: req.body.name, location: req.body.location }], { session });
        await writeAudit(req.user._id, "CREATE", "Bases", `Created base ${record.name}`, record._id, record.toObject(), session);
        return record;
    });
    res.status(201).json({ base });
};

const listAssets = async (req, res) => {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    res.json({ assets: await Asset.find(filter).sort({ name: 1 }).lean() });
};

const createAsset = async (req, res) => {
    const { name, type, unit, description } = req.body;
    if (!name || !type || !unit) throw new AppError("Asset name, type, and unit are required");
    const asset = await withTransaction(async (session) => {
        const [record] = await Asset.create([{ name, type, unit, description }], { session });
        await writeAudit(req.user._id, "CREATE", "Assets", `Created asset ${record.name}`, record._id, record.toObject(), session);
        return record;
    });
    res.status(201).json({ asset });
};

const listInventory = async (req, res) => {
    const filter = { ...scopeQuery(req.user) };
    if (req.query.baseId && req.user.role === "Admin") filter.baseId = req.query.baseId;
    if (req.query.type) {
        const assets = await Asset.find({ type: req.query.type }).select("_id").lean();
        filter.assetId = { $in: assets.map(({ _id }) => _id) };
    }
    const rows = await Inventory.find(filter)
        .populate("assetId", "name type unit")
        .populate("baseId", "name location")
        .sort({ lastUpdated: -1 })
        .lean();
    res.json({ inventory: rows });
};

const addOpeningBalance = async (req, res) => {
    const { assetId, quantity } = req.body;
    if (!assetId || !Number.isSafeInteger(quantity) || quantity < 1) {
        throw new AppError("An asset and a positive whole-number opening quantity are required");
    }
    const baseId = requireBase(req.user, req.body.baseId);
    if (!(await Asset.exists({ _id: assetId }))) throw new AppError("Asset not found", 404);
    if (await Inventory.exists({ assetId, baseId })) {
        throw new AppError("Opening stock is already established for this asset at this base; record a purchase for new stock", 409);
    }
    const row = await withTransaction(async (session) => {
        const inventory = await Inventory.create([{
            assetId, baseId, openingBalance: quantity, currentStock: quantity
        }], { session });
        const [record] = inventory;
        await writeAudit(req.user._id, "CREATE", "Inventory", `Established opening stock of ${quantity} units`, record._id, record.toObject(), session);
        return record;
    });
    res.status(201).json({ inventory: row });
};

module.exports = { listBases, createBase, listAssets, createAsset, listInventory, addOpeningBalance };