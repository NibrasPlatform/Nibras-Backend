const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema(
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
    completedSections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Section",
      },
    ],
    // Track individual items (sections, assignments, projects, quizzes, participation)
    items: [
      {
        itemId: { type: mongoose.Schema.Types.ObjectId, refPath: "items.itemModel" },
        itemModel: { type: String, enum: ["Section", "Assignment", "Project", "Quiz", "Participation"] },
        itemType: { type: String, enum: ["section", "assignment", "project", "quiz", "participation"] },
        order: { type: Number, default: 0 },
        mandatory: { type: Boolean, default: true },
        status: { type: String, enum: ["locked", "available", "completed"], default: "locked" },
      },
    ],
    weightedGrade: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
  },
  { timestamps: true }
);

// Unique index on userId and courseId
progressSchema.index({ userId: 1, courseId: 1 }, { unique: true });
// Index for course-level queries (course performance dashboard)
progressSchema.index({ courseId: 1 });

module.exports = mongoose.models.Progress || mongoose.model("Progress", progressSchema);
