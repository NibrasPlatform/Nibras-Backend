const mongoose = require("mongoose");

const verificationStateSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["unverified", "pending", "verified", "expired", "failed"],
      default: "unverified",
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const syncStateSchema = new mongoose.Schema(
  {
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    nextSyncAt: {
      type: Date,
      default: null,
    },
    syncStatus: {
      type: String,
      enum: ["idle", "syncing", "success", "failed"],
      default: "idle",
    },
    syncError: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const platformsSchema = new mongoose.Schema(
  {
    codeforces: {
      handle: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
      },
      verification: {
        type: verificationStateSchema,
        default: () => ({}),
      },
      sync: {
        type: syncStateSchema,
        default: () => ({}),
      },
    },
    leetcode: {
      username: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
      },
      verification: {
        type: verificationStateSchema,
        default: () => ({}),
      },
      sync: {
        type: syncStateSchema,
        default: () => ({}),
      },
    },
    hackerrank: {
      username: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
      },
      verification: {
        type: verificationStateSchema,
        default: () => ({}),
      },
      sync: {
        type: syncStateSchema,
        default: () => ({}),
      },
    },
  },
  { _id: false },
);

const userCompetitiveAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    platforms: {
      type: platformsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

userCompetitiveAccountSchema.index(
  { "platforms.codeforces.handle": 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      "platforms.codeforces.handle": { $type: "string" },
    },
  },
);

userCompetitiveAccountSchema.index(
  { "platforms.leetcode.username": 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      "platforms.leetcode.username": { $type: "string" },
    },
  },
);

userCompetitiveAccountSchema.index(
  { "platforms.hackerrank.username": 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      "platforms.hackerrank.username": { $type: "string" },
    },
  },
);

userCompetitiveAccountSchema.index({ "platforms.codeforces.verification.expiresAt": 1 });
userCompetitiveAccountSchema.index({ "platforms.leetcode.verification.expiresAt": 1 });
userCompetitiveAccountSchema.index({ "platforms.hackerrank.verification.expiresAt": 1 });

module.exports = mongoose.model("UserCompetitiveAccount", userCompetitiveAccountSchema);
