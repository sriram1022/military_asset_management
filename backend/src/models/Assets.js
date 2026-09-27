const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    type: {
      type: String,
      enum: ["Weapon", "Vehicle", "Ammunition"],
      required: true
    },

    unit: {
      type: String,
      enum: ["Piece", "Box", "Vehicle"],
      required: true
    },

    description: String
  },
  {
    timestamps: true
  }
);

assetSchema.index({ name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Asset", assetSchema);