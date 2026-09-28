const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Inventory = require("../src/models/Inventory");
const Transfer = require("../src/models/Transfer");
const Purchase = require("../src/models/Purchase");
const User = require("../src/models/User");
const { authorize } = require("../src/middleware/authMiddleware");
const app = require("../src/app");

test("inventory requires a non-negative opening and current balance", async () => {
    const inventory = new Inventory({
        assetId: new mongoose.Types.ObjectId(),
        baseId: new mongoose.Types.ObjectId(),
        openingBalance: -1,
        currentStock: 4
    });
    await assert.rejects(inventory.validate(), /openingBalance/);
});

test("transfers cannot move assets to the same base", async () => {
    const baseId = new mongoose.Types.ObjectId();
    const transfer = new Transfer({
        assetId: new mongoose.Types.ObjectId(),
        fromBaseId: baseId,
        toBaseId: baseId,
        quantity: 1,
        initiatedBy: new mongoose.Types.ObjectId()
    });
    await assert.rejects(transfer.validate(), /different base/);
});

test("user role validation rejects unknown roles", async () => {
    const user = new User({ name: "Operator", email: "operator@example.com", passwordHash: "hash", role: "Visitor" });
    await assert.rejects(user.validate(), /role/);
});

test("role middleware blocks a role outside the allow-list", () => {
    const middleware = authorize("Admin", "BaseCommander");
    let statusCode;
    let nextCalled = false;
    const response = { status(code) { statusCode = code; return this; }, json() { return this; } };
    middleware({ user: { role: "LogisticsOfficer" } }, response, () => { nextCalled = true; });
    assert.equal(statusCode, 403);
    assert.equal(nextCalled, false);
});

test("role middleware continues for an allowed role", () => {
    const middleware = authorize("Admin");
    let nextCalled = false;
    middleware({ user: { role: "Admin" } }, { status() { return this; }, json() { return this; } }, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
});

test("purchase quantities must be whole numbers", async () => {
    const purchase = new Purchase({
        assetId: new mongoose.Types.ObjectId(),
        baseId: new mongoose.Types.ObjectId(),
        quantity: 1.5,
        addedBy: new mongoose.Types.ObjectId()
    });
    await assert.rejects(purchase.validate(), /whole number/);
});

test("health endpoint responds without a database dependency", async (context) => {
    const server = app.listen(0);
    context.after(() => server.close());
    await new Promise((resolve) => server.once("listening", resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
});

test("CORS allows configured and localhost-style frontend origins", async (context) => {
    const previousClientUrl = process.env.CLIENT_URL;
    process.env.CLIENT_URL = "https://military-asset-management-three-iota.vercel.app/";
    delete require.cache[require.resolve("../src/app")];
    const appWithCors = require("../src/app");
    const server = appWithCors.listen(0);
    context.after(() => {
        server.close();
        if (previousClientUrl === undefined) {
            delete process.env.CLIENT_URL;
        } else {
            process.env.CLIENT_URL = previousClientUrl;
        }
        delete require.cache[require.resolve("../src/app")];
    });
    await new Promise((resolve) => server.once("listening", resolve));
    const origin = "https://military-asset-management-three-iota.vercel.app";
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`, {
        headers: { Origin: origin }
    });
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
});