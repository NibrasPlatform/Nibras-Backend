const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    courseCode: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    thumbnail: { type: String, default: "default-course.jpg" },
    description: { type: String, default: "" },
    level: {
      type: String,
      required: true,
      enum: ["Beginner", "Intermediate", "Advanced"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["Core", "Elective", "Competitive Programming", "General"],
      default: "General",
      trim: true,
    },
    instructorName: { type: String, default: "" },
    stats: {
      duration: { type: String, default: "" },
      hoursPerWeek: { type: Number, default: 0 },
      enrolledStudents: { type: Number, default: 0 },
      term: { type: String, default: "" },
    },
    assignments: [
      {
        assignmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
        title: { type: String, required: true, trim: true },
      },
    ],
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Section" }],
  },
  { timestamps: true }
);

courseSchema.index({ instructor: 1 });

courseSchema.pre("findOneAndDelete", async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    await mongoose.model("Section").deleteMany({ courseId: doc._id });
    await mongoose.model("Lesson").deleteMany({ courseId: doc._id });
  }
  next();
});

module.exports = mongoose.models.Course || mongoose.model("Course", courseSchema);
