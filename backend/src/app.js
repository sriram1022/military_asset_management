const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { handleError } = require("./utils/errors");
const authRoutes = require("./routes/authRoutes");
const resourceRoutes = require("./routes/resourceRoutes");
const operationsRoutes = require("./routes/operationsRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();
const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
];
const configuredOrigins = (process.env.CLIENT_URL || "").split(",").map((origin) => origin.trim()).filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...configuredOrigins]));
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^https?:\/\/localhost(?::\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/[\w.-]+\.(vercel\.app|onrender\.com|render\.com)(?::\d+)?$/.test(origin)) return true;
  return false;
};

app.disable("x-powered-by");
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true
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