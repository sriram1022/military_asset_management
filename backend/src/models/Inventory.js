const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: true
    },

    baseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Base",
      required: true
    },

    openingBalance: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isSafeInteger, message: "Opening balance must be a whole number" }
    },

    currentStock: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isSafeInteger, message: "Current stock must be a whole number" }
    },

    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
);

inventorySchema.index({ assetId: 1, baseId: 1 }, { unique: true });

module.exports = mongoose.model("Inventory", inventorySchema);