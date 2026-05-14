const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const mongoose = require("mongoose");
const Course = require("../../modules/courses/models/course.model");
const Section = require("../../modules/courses/models/section.model");
const Lesson = require("../../modules/courses/models/lesson.model");
const User = require("../../modules/users/models/user.model");

const COURSES = [
  // --- Beginner Courses (16) ---
  { code: "CS103", title: "Mathematical Foundations of Computing", level: "Beginner" },
  { code: "CS106A", title: "Programming Methodology", level: "Beginner" },
  { code: "CS106B", title: "Programming Abstractions", level: "Beginner" },
  { code: "CS106X", title: "Programming Abstractions (Accelerated)", level: "Beginner" },
  { code: "CS109", title: "Probability for Computer Scientists", level: "Beginner" },
  { code: "MATH18", title: "Foundations for Calculus", level: "Beginner" },
  { code: "MATH19", title: "Calculus I", level: "Beginner" },
  { code: "MATH20", title: "Calculus II", level: "Beginner" },
  { code: "MATH21", title: "Calculus III", level: "Beginner" },
  { code: "MATH51", title: "Linear Algebra & Multivariable Optimization", level: "Beginner" },
  { code: "MATH52", title: "Integral Calculus of Several Variables", level: "Beginner" },
  { code: "MATH53", title: "Ordinary Differential Equations", level: "Beginner" },
  { code: "PHYS41", title: "Mechanics", level: "Beginner" },
  { code: "PHYS43", title: "Electricity and Magnetism", level: "Beginner" },
  { code: "BIO", title: "Introduction to Biology", level: "Beginner" },
  { code: "CHEM", title: "General Chemistry", level: "Beginner" },

  // --- Intermediate Courses (16) ---
  { code: "CS107", title: "Computer Organization & Systems", level: "Intermediate" },
  { code: "CS110", title: "Principles of Computer Systems", level: "Intermediate" },
  { code: "CS157", title: "Computational Logic", level: "Intermediate" },
  { code: "CS161", title: "Design and Analysis of Algorithms", level: "Intermediate" },
  { code: "CS181", title: "Computers, Ethics, and Public Policy", level: "Intermediate" },
  { code: "CS181W", title: "Computers, Ethics, and Public Policy (Writing)", level: "Intermediate" },
  { code: "CS205L", title: "Continuous Mathematical Methods", level: "Intermediate" },
  { code: "ENGR40M", title: "Introduction to Electronics", level: "Intermediate" },
  { code: "ENGR76", title: "Information Science and Engineering", level: "Intermediate" },
  { code: "MATH104", title: "Applied Linear Algebra", level: "Intermediate" },
  { code: "MATH107", title: "Graph Theory", level: "Intermediate" },
  { code: "MATH108", title: "Introduction to Combinatorics", level: "Intermediate" },
  { code: "MATH109", title: "Applied Group Theory", level: "Intermediate" },
  { code: "MATH110", title: "Applied Number Theory", level: "Intermediate" },
  { code: "MATH113", title: "Linear Algebra and Matrix Theory", level: "Intermediate" },
  { code: "PHIL251", title: "Philosophy of Mind", level: "Intermediate" }
];

const SECTION_TITLES = [
  "Introduction and Course Orientation",
  "Core Concepts and Practice",
  "Applied Problem Solving",
  "Review and Capstone Preparation",
];

const createAssignmentPlaceholders = () => {
  return [
    { assignmentId: new mongoose.Types.ObjectId(), title: "Assignment 1" },
    { assignmentId: new mongoose.Types.ObjectId(), title: "Assignment 2" },
    { assignmentId: new mongoose.Types.ObjectId(), title: "Assignment 3" },
  ];
};

const ensureInstructor = async () => {
  const existing = await User.findOne({ email: "abdallahrt@gmail.com" });
  if (existing) return existing;

  return User.create({
    name: "AbdallahRT",
    email: "abdallahrt@gmail.com",
    password: "TempPass123",
    authProvider: "manual",
    role: "instructor",
    isVerified: true,
  });
};

const seedData = async () => {
  const dbUrl = process.env.DATABASE_URL || process.env.MONGO_URI;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is required in .env");
  }

  await mongoose.connect(dbUrl);
  console.log("Connected to MongoDB");

  const instructor = await ensureInstructor();

  // Wipe old data
  await Lesson.deleteMany({});
  await Section.deleteMany({});
  await Course.deleteMany({});

  for (const base of COURSES) {
    // 💡 الحل هنا: استخدمنا "Core" عشان نرضي الـ Validation بتاع المونجوس عندك
    const course = await Course.create({
      courseCode: base.code,
      title: base.title,
      category: "Core", 
      level: base.level,
      instructor: instructor._id,
      instructorName: "AbdallahRT",
      description: `${base.title} course content for Nibras students.`,
      assignments: createAssignmentPlaceholders(),
      stats: {
        duration: "8 weeks",
        hoursPerWeek: 6,
        enrolledStudents: 0,
        term: "Fall 2026",
      },
    });

    const sectionIds = [];
    for (let i = 0; i < SECTION_TITLES.length; i++) {
      const section = await Section.create({
        title: SECTION_TITLES[i],
        courseId: course._id,
        order: i + 1,
      });
      sectionIds.push(section._id);
    }

    course.sections = sectionIds;
    await course.save();
  }

  console.log(`✅ Success! Seeded ${COURSES.length} courses successfully.`);
  await mongoose.disconnect();
  console.log("Disconnected.");
};

seedData().catch(async (error) => {
  console.error("Seeding failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});