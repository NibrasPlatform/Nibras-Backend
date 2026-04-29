const mongoose = require("mongoose");

const userProblemProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
    },
    solved: {
      type: Boolean,
      required: true,
      default: true,
    },
    solvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userProblemProgressSchema.index({ userId: 1, problemId: 1 }, { unique: true });
userProblemProgressSchema.index({ userId: 1, solved: 1 });

module.exports = mongoose.model("UserProblemProgress", userProblemProgressSchema);
