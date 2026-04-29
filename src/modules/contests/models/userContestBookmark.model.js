const mongoose = require("mongoose");

const userContestBookmarkSchema = new mongoose.Schema(
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
  },
  {
    timestamps: true,
  }
);

// Ensure a user can only bookmark a contest once
userContestBookmarkSchema.index({ userId: 1, contestId: 1 }, { unique: true });

module.exports = mongoose.model("UserContestBookmark", userContestBookmarkSchema);
