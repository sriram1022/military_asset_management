const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { handleError } = require("./utils/errors");
const authRoutes = require("./routes/authRoutes");
const resourceRoutes = require("./routes/resourceRoutes");
const operationsRoutes = require("./routes/operationsRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || "").split(",").map((origin) => origin.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Origin is not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "100kb" }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({
    message: "Military Asset Management API"
  });
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api", resourceRoutes);
app.use("/api", operationsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use((req, res) => res.status(404).json({ message: "Endpoint not found" }));
app.use(handleError);

module.exports = app;