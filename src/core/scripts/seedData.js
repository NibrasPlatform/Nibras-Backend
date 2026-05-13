const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const mongoose = require("mongoose");
const Course = require("../../modules/courses/models/course.model");
const Section = require("../../modules/courses/models/section.model");
const Lesson = require("../../modules/courses/models/lesson.model");
const User = require("../../modules/users/models/user.model");

const COURSES = [
  { code: "CS106A", title: "Programming Methodology", category: "Core" },
  { code: "CS106B", title: "Programming Abstractions", category: "Core" },
  { code: "MATH101", title: "Calculus I", category: "Core" },
  { code: "MATH102", title: "Calculus II", category: "Core" },
  { code: "MATH103", title: "Calculus III", category: "Core" },
  { code: "MATH201", title: "Linear Algebra", category: "Core" },
  { code: "CS107", title: "Computer Organization", category: "Core" },
  { code: "CS109", title: "Probability for Computer Scientists", category: "Core" },
  { code: "CS161", title: "Design and Analysis of Algorithms", category: "Core" },
  { code: "CS110", title: "Principles of Computer Systems", category: "Elective" },
  { code: "CS124", title: "From Languages to Information", category: "Elective" },
  { code: "CS142", title: "Web Applications", category: "Elective" },
  { code: "CP201", title: "Competitive Programming Fundamentals", category: "Competitive Programming" },
  { code: "CP202", title: "Advanced Problem Solving", category: "Competitive Programming" },
  { code: "CS999", title: "Study Skills for CS", category: "General" },
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
    isVerified: true,
  });
};

const seedData = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in .env");
  }

  await mongoose.connect(process.env.DATABASE_URL);
  console.log("Connected to MongoDB");

  const instructor = await ensureInstructor();

  // wipe old static course content
  await Lesson.deleteMany({});
  await Section.deleteMany({});
  await Course.deleteMany({});

  for (const base of COURSES) {
    const course = await Course.create({
      courseCode: base.code,
      title: base.title,
      category: base.category,
      level: "Beginner",
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

  console.log("Seed completed: 15 courses with 4 sections each and 3 assignment placeholders.");
  await mongoose.disconnect();
  console.log("Disconnected.");
};

seedData().catch(async (error) => {
  console.error("Seeding failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
