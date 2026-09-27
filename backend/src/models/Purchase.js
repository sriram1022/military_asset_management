const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
    {
        assetId: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true },
        baseId: { type: mongoose.Schema.Types.ObjectId, ref: "Base", required: true },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            validate: { validator: Number.isSafeInteger, message: "Quantity must be a whole number" }
        },
        purchaseDate: { type: Date, required: true, default: Date.now },
        supplier: { type: String, trim: true, default: "" },
        remarks: { type: String, trim: true, default: "" },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Purchase", purchaseSchema);