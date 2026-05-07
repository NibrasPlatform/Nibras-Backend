const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["refresh", "resetPassword", "verifyEmail"],
      required: true,
    },
    expires: {
      type: Date,
      required: true,
      index: { expires: "0s" },
    },
    blacklisted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Token || mongoose.model("Token", tokenSchema);
