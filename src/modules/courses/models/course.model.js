const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    thumbnail: { type: String, default: "default-course.jpg" },
    description: { type: String, default: "" },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Section" }],
  },
  { timestamps: true }
);

courseSchema.pre("findOneAndDelete", async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    await mongoose.model("Section").deleteMany({ courseId: doc._id });
    await mongoose.model("Lesson").deleteMany({ courseId: doc._id });
  }
  next();
});

module.exports = mongoose.models.Course || mongoose.model("Course", courseSchema);
