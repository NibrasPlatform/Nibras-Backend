const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index for course section queries sorted by order (course performance dashboard)
sectionSchema.index({ courseId: 1, order: 1 });
sectionSchema.index({ courseId: 1 });

module.exports = mongoose.models.Section || mongoose.model("Section", sectionSchema);
