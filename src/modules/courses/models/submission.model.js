const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    githubLink: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "needs_changes"],
      default: "pending",
    },
    grade: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
  },
  { timestamps: true }
);

submissionSchema.index({ userId: 1, courseId: 1, assignmentId: 1 }, { unique: true });

module.exports = mongoose.models.Submission || mongoose.model("Submission", submissionSchema);
