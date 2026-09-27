const mongoose = require("mongoose");

const expenditureSchema = new mongoose.Schema(
    {
        assetId: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true },
        baseId: { type: mongoose.Schema.Types.ObjectId, ref: "Base", required: true },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            validate: { validator: Number.isSafeInteger, message: "Quantity must be a whole number" }
        },
        reason: {
            type: String,
            enum: ["Used", "Damaged", "Destroyed", "Expired"],
            required: true
        },
        expendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        expenditureDate: { type: Date, required: true, default: Date.now },
        remarks: { type: String, trim: true, default: "" }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Expenditure", expenditureSchema);