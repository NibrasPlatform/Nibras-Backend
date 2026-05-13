const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
// تأكد إن المسارات دي صحيحة حسب الفولدرات عندك
const Course = require("../modules/courses/models/course.model");
const User = require("../modules/users/models/user.model"); 

const beginnerCourses = [
  {
    courseCode: "CS106A",
    title: "Programming Methodology",
    level: "Beginner",
    description: "Introduction to the engineering of computer applications emphasizing modern software engineering principles.",
    stats: { duration: "8 Weeks", hoursPerWeek: 11, enrolledStudents: 180, term: "Fall 2024" }
  },
  {
    courseCode: "CS106B",
    title: "Programming Abstractions",
    level: "Beginner",
    description: "Abstraction and its relation to programming. Software engineering principles of data abstraction and modularity.",
    stats: { duration: "10 Weeks", hoursPerWeek: 14, enrolledStudents: 150, term: "Fall 2024" }
  },
  {
    courseCode: "CS106X",
    title: "Programming Abstractions (Accelerated)",
    level: "Beginner",
    description: "An accelerated version of CS106B for students with strong programming backgrounds.",
    stats: { duration: "10 Weeks", hoursPerWeek: 18, enrolledStudents: 80, term: "Fall 2024" }
  },
  {
    courseCode: "MATH19",
    title: "Calculus I",
    level: "Beginner",
    description: "Introduction to differential calculus of functions of one variable.",
    stats: { duration: "10 Weeks", hoursPerWeek: 8, enrolledStudents: 200, term: "Fall 2024" }
  },
  {
    courseCode: "MATH20",
    title: "Calculus II",
    level: "Beginner",
    description: "Continuation of differential calculus and introduction to integral calculus.",
    stats: { duration: "10 Weeks", hoursPerWeek: 8, enrolledStudents: 190, term: "Winter 2025" }
  },
  {
    courseCode: "MATH21",
    title: "Calculus III",
    level: "Beginner",
    description: "Integrals, infinite series, and introduction to multivariable calculus.",
    stats: { duration: "10 Weeks", hoursPerWeek: 8, enrolledStudents: 170, term: "Spring 2025" }
  },
  {
    courseCode: "CS103",
    title: "Mathematical Foundations of Computing",
    level: "Beginner",
    description: "Logic, proof techniques, sets, functions, and relations. Foundation for algorithms.",
    stats: { duration: "10 Weeks", hoursPerWeek: 12, enrolledStudents: 140, term: "Fall 2024" }
  },
  {
    courseCode: "MATH51",
    title: "Linear Algebra & Multivariable Optimization",
    level: "Beginner",
    description: "Linear algebra and multivariable differential calculus with an emphasis on applications.",
    stats: { duration: "10 Weeks", hoursPerWeek: 12, enrolledStudents: 160, term: "Fall 2024" }
  },
  {
    courseCode: "MATH52",
    title: "Integral Calculus of Several Variables",
    level: "Beginner",
    description: "Iterated integrals, line and surface integrals, and applications of vector calculus.",
    stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 110, term: "Winter 2025" }
  },
  {
    courseCode: "MATH53",
    title: "Ordinary Differential Equations",
    level: "Beginner",
    description: "Introduction to differential equations and their applications in science and engineering.",
    stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 100, term: "Spring 2025" }
  },
  {
    courseCode: "CS109",
    title: "Probability for Computer Scientists",
    level: "Beginner",
    description: "Probability theory and statistics with a focus on computer science applications.",
    stats: { duration: "10 Weeks", hoursPerWeek: 14, enrolledStudents: 130, term: "Fall 2024" }
  },
  {
    courseCode: "PHYS41",
    title: "Mechanics",
    level: "Beginner",
    description: "Vectors, particle kinematics and dynamics, work, energy, and momentum.",
    stats: { duration: "10 Weeks", hoursPerWeek: 9, enrolledStudents: 100, term: "Fall 2024" }
  },
  {
    courseCode: "PHYS43",
    title: "Electricity and Magnetism",
    level: "Beginner",
    description: "Charges, currents, magnetic fields, and Maxwell's equations.",
    stats: { duration: "10 Weeks", hoursPerWeek: 9, enrolledStudents: 90, term: "Winter 2025" }
  },
  {
    courseCode: "BIO",
    title: "Introduction to Biology",
    level: "Beginner",
    description: "Foundational principles of biological systems and molecular biology.",
    stats: { duration: "8 Weeks", hoursPerWeek: 6, enrolledStudents: 120, term: "Spring 2025" }
  },
  {
    courseCode: "CHEM",
    title: "General Chemistry",
    level: "Beginner",
    description: "Atomic structure, chemical bonding, and stoichiometry.",
    stats: { duration: "8 Weeks", hoursPerWeek: 6, enrolledStudents: 110, term: "Fall 2024" }
  }
];

const intermediateCourses = [
  {
    courseCode: "CS107",
    title: "Computer Organization & Systems",
    level: "Intermediate",
    description: "Introduction to computer systems, memory models, and low-level programming.",
    stats: { duration: "10 Weeks", hoursPerWeek: 15, enrolledStudents: 140, term: "Fall 2024" }
  },
  {
    courseCode: "CS110",
    title: "Principles of Computer Systems",
    level: "Intermediate",
    description: "Principles and practices of computer systems, networking, and concurrency.",
    stats: { duration: "10 Weeks", hoursPerWeek: 16, enrolledStudents: 130, term: "Winter 2025" }
  },
  {
    courseCode: "CS161",
    title: "Design and Analysis of Algorithms",
    level: "Intermediate",
    description: "Fundamental principles of algorithm design, analysis, and complexity.",
    stats: { duration: "10 Weeks", hoursPerWeek: 18, enrolledStudents: 120, term: "Fall 2024" }
  },
  {
    courseCode: "CS181",
    title: "Computers, Ethics, and Public Policy",
    level: "Intermediate",
    description: "Social framework of computing, ethics, and policy issues.",
    stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 95, term: "Spring 2025" }
  },
  {
    courseCode: "CS157",
    title: "Computational Logic",
    level: "Intermediate",
    description: "Logic from a computational perspective, including automated reasoning and verification.",
    stats: { duration: "10 Weeks", hoursPerWeek: 12, enrolledStudents: 95, term: "Winter 2025" }
  },
  {
    courseCode: "ENGR40M",
    title: "Introduction to Electronics",
    level: "Intermediate",
    description: "Foundational electronics and circuit design with hands-on labs.",
    stats: { duration: "10 Weeks", hoursPerWeek: 12, enrolledStudents: 110, term: "Fall 2024" }
  },
  {
    courseCode: "MATH113",
    title: "Linear Algebra and Matrix Theory",
    level: "Intermediate",
    description: "Linear transformations, matrices, determinants, and vector spaces.",
    stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 85, term: "Spring 2025" }
  },
  {
    courseCode: "MATH104",
    title: "Applied Linear Algebra",
    level: "Intermediate",
    description: "Practical applications of linear algebra in science and engineering.",
    stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 80, term: "Fall 2024" }
  }
];
const seedCourses = async () => {
  const dbUrl = process.env.DATABASE_URL || process.env.MONGO_URI;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is required in the .env file.");
  }

  try {
    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB Atlas");

    // الحركة القاضية: نجيب أول يوزر موجود عشان الـ Validation ميزعلش
    const adminUser = await User.findOne();
    if (!adminUser) {
      console.error("❌ مفيش يوزرز في الداتابيز! رن سكريبت seedRoles.js الأول.");
      process.exit(1);
    }
    console.log(`Using instructor: ${adminUser.email}`);

    await Course.deleteMany({});
    console.log("Cleared courses collection");

    // دمج الداتا وحقن الـ Instructor ID
    const allCourses = [...beginnerCourses, ...intermediateCourses].map(course => ({
      ...course,
      instructor: adminUser._id 
    }));

    await Course.insertMany(allCourses);
    console.log(`✅ Successfully seeded ${allCourses.length} courses!`);

  } catch (error) {
    console.error("❌ Course seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

seedCourses();