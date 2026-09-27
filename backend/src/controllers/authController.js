const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Base = require("../models/Bases");
const writeAudit = require("../utils/audit");
const { AppError } = require("../utils/errors");
const withTransaction = require("../utils/transaction");

const publicUser = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    baseId: user.baseId
});

const signToken = (user) => jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
);

const login = async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(String(req.body.password || ""), user.passwordHash))) {
        throw new AppError("Email or password is incorrect", 401);
    }
    await writeAudit(user._id, "LOGIN", "Authentication", "User signed in");
    res.json({ token: signToken(user), user: publicUser(user) });
};

const createUser = async (req, res) => {
    const { name, email, password, role, baseId = null } = req.body;
    if (!name || !email || !password || !["Admin", "BaseCommander", "LogisticsOfficer"].includes(role)) {
        throw new AppError("Name, email, password, and a valid role are required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) throw new AppError("Enter a valid email address");
    if (password.length < 12) throw new AppError("Passwords must be at least 12 characters");
    if ((role === "Admin" && baseId) || (role !== "Admin" && !baseId)) {
        throw new AppError("Admins must not have a base; other roles must be assigned to one");
    }
    if (baseId && !(await Base.exists({ _id: baseId }))) throw new AppError("Base not found", 404);
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await withTransaction(async (session) => {
        const [record] = await User.create([{
            name,
            email: String(email).trim().toLowerCase(),
            passwordHash,
            role,
            baseId
        }], { session });
        await writeAudit(req.user._id, "CREATE", "Users", `Created ${role} account ${record.email}`, record._id, {
            name: record.name, email: record.email, role: record.role, baseId: record.baseId
        }, session);
        return record;
    });
    res.status(201).json({ user: publicUser(user) });
};

const me = (req, res) => res.json({ user: req.user });

const listUsers = async (req, res) => {
    const users = await User.find().select("name email role baseId createdAt").populate("baseId", "name").sort({ name: 1 }).lean();
    res.json({ users });
};

module.exports = { login, createUser, listUsers, me };