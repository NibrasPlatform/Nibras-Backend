const mongoose = require("mongoose");

const userContestReminderSchema = new mongoose.Schema(
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
    reminderSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user can only have one reminder per contest
userContestReminderSchema.index({ userId: 1, contestId: 1 }, { unique: true });

module.exports = mongoose.model("UserContestReminder", userContestReminderSchema);
