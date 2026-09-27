require("dotenv").config();
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const connectDB = require("./config/db");
const User = require("./models/User");
const Base = require("./models/Bases");
const writeAudit = require("./utils/audit");
const withTransaction = require("./utils/transaction");

const accountConfig = [
    {
        role: "BaseCommander",
        nameKey: "BASE_COMMANDER_NAME",
        emailKey: "BASE_COMMANDER_EMAIL",
        passwordKey: "BASE_COMMANDER_PASSWORD",
        fallbackName: "Base Commander",
        fallbackEmail: "commander@fieldstock.local"
    },
    {
        role: "LogisticsOfficer",
        nameKey: "LOGISTICS_NAME",
        emailKey: "LOGISTICS_EMAIL",
        passwordKey: "LOGISTICS_PASSWORD",
        fallbackName: "Logistics Officer",
        fallbackEmail: "logistics@fieldstock.local"
    }
];

const seed = async () => {
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
        throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in .env");
    }
    if (process.env.NODE_ENV === "production" && accountConfig.some(({ emailKey, passwordKey }) => !process.env[emailKey] || !process.env[passwordKey])) {
        throw new Error("Production seeding requires explicit BASE_COMMANDER_EMAIL/PASSWORD and LOGISTICS_EMAIL/PASSWORD values");
    }
    await connectDB();
    const credentials = [];
    await withTransaction(async (session) => {
        const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
        let admin = await User.findOne({ email: adminEmail }).session(session);
        if (!admin) {
            [admin] = await User.create([{
                name: process.env.ADMIN_NAME || "System Administrator",
                email: adminEmail,
                passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
                role: "Admin",
                baseId: null
            }], { session });
            await writeAudit(admin._id, "CREATE", "Users", "Created the initial administrator account", admin._id, {
                email: admin.email,
                role: admin.role
            }, session);
            console.log(`Created Admin: ${admin.email}`);
        } else if (admin.role !== "Admin") {
            throw new Error("ADMIN_EMAIL belongs to an account that is not an Admin; refusing to change its role");
        } else {
            console.log(`Admin already exists: ${admin.email}`);
        }

        let base;
        if (process.env.ROLE_BASE_ID) {
            base = await Base.findById(process.env.ROLE_BASE_ID).session(session);
        } else if (process.env.ROLE_BASE_NAME) {
            base = await Base.findOne({ name: process.env.ROLE_BASE_NAME }).session(session);
        } else {
            base = await Base.findOne().sort({ createdAt: 1 }).session(session);
        }
        if (!base) {
            const [createdBase] = await Base.create([{
                name: process.env.ROLE_BASE_NAME || "Training Base",
                location: process.env.ROLE_BASE_LOCATION || "Set location in admin settings"
            }], { session });
            base = createdBase;
            await writeAudit(admin._id, "CREATE", "Bases", `Created seed base ${base.name}`, base._id, base.toObject(), session);
            console.log(`Created base for role accounts: ${base.name}`);
        }

        for (const config of accountConfig) {
            const email = (process.env[config.emailKey] || config.fallbackEmail).trim().toLowerCase();
            const existing = await User.findOne({ email }).session(session);
            if (existing) {
                if (existing.role !== config.role) {
                    throw new Error(`${config.emailKey} belongs to an account with a different role; refusing to change it`);
                }
                if (!existing.baseId || String(existing.baseId) !== String(base._id)) {
                    const oldBaseId = existing.baseId;
                    existing.baseId = base._id;
                    await existing.save({ session });
                    await writeAudit(admin._id, "UPDATE", "Users", `Reassigned ${config.role} to ${base.name}`, existing._id, {
                        role: existing.role,
                        oldBaseId,
                        baseId: base._id
                    }, session);
                }
                console.log(`${config.role} already exists: ${email}`);
                continue;
            }

            const configuredPassword = process.env[config.passwordKey];
            if (configuredPassword && configuredPassword.length < 12) {
                throw new Error(`${config.passwordKey} must be at least 12 characters`);
            }
            const password = configuredPassword || crypto.randomBytes(18).toString("base64url");
            const [user] = await User.create([{
                name: process.env[config.nameKey] || config.fallbackName,
                email,
                passwordHash: await bcrypt.hash(password, 12),
                role: config.role,
                baseId: base._id
            }], { session });
            await writeAudit(admin._id, "CREATE", "Users", `Created ${config.role} account ${email}`, user._id, {
                name: user.name,
                email: user.email,
                role: user.role,
                baseId: user.baseId
            }, session);
            credentials.push({ role: config.role, email, password, generated: !configuredPassword });
        }
    });

    for (const credential of credentials) {
        console.log(`${credential.role} login: ${credential.email}`);
        if (credential.generated) {
            console.log(`Temporary password (shown once; store it securely): ${credential.password}`);
        } else {
            console.log(`Password is configured by ${credential.role === "BaseCommander" ? "BASE_COMMANDER_PASSWORD" : "LOGISTICS_PASSWORD"} in .env`);
        }
    }
    if (!credentials.length) console.log("Role accounts already exist; passwords were not changed.");
    console.log("Seed complete. All non-admin accounts are assigned to the selected base.");
};

seed().catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
}).finally(async () => {
    const mongoose = require("mongoose");
    await mongoose.disconnect();
});