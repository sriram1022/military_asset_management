const mongoose = require("mongoose");

const transferSchema = new mongoose.Schema(
    {
        assetId: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true },
        fromBaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Base", required: true },
        toBaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Base", required: true },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            validate: { validator: Number.isSafeInteger, message: "Quantity must be a whole number" }
        },
        transferDate: { type: Date, required: true, default: Date.now },
        remarks: { type: String, trim: true, default: "" },
        initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
    },
    { timestamps: true }
);

transferSchema.pre("validate", function rejectSameBase() {
    if (this.fromBaseId && this.fromBaseId.equals(this.toBaseId)) {
        this.invalidate("toBaseId", "A transfer must move assets to a different base");
    }
});

module.exports = mongoose.model("Transfer", transferSchema);