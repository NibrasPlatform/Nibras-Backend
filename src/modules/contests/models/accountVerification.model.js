const mongoose = require("mongoose");

const accountVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ["codeforces", "leetcode", "hackerrank"],
      index: true,
    },
    accountIdentifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    method: {
      type: String,
      required: true,
      enum: ["submission_token", "profile_bio_token"],
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: ["pending", "verified", "failed", "expired", "superseded"],
      default: "pending",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

accountVerificationSchema.index({ userId: 1, platform: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("AccountVerification", accountVerificationSchema);
