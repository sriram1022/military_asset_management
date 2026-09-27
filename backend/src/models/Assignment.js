const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
    {
        assetId: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true },
        baseId: { type: mongoose.Schema.Types.ObjectId, ref: "Base", required: true },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            validate: { validator: Number.isSafeInteger, message: "Quantity must be a whole number" }
        },
        assignedTo: { type: String, required: true, trim: true },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        assignmentDate: { type: Date, required: true, default: Date.now },
        remarks: { type: String, trim: true, default: "" }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Assignment", assignmentSchema);