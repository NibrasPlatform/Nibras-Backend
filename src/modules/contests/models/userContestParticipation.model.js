const mongoose = require("mongoose");

const userContestParticipationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    contestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ["codeforces", "leetcode", "hackerrank"],
    },
    contestName: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    rank: {
      type: Number,
      default: null,
    },
    ratingChange: {
      type: Number,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      required: true,
      enum: ["bookmark", "reminder", "manual"],
    },
  },
  {
    timestamps: true,
  }
);

userContestParticipationSchema.index({ userId: 1 });
userContestParticipationSchema.index({ contestId: 1 });
userContestParticipationSchema.index({ startTime: -1 });
userContestParticipationSchema.index({ userId: 1, contestId: 1 }, { unique: true });

module.exports = mongoose.model(
  "UserContestParticipation",
  userContestParticipationSchema
);
