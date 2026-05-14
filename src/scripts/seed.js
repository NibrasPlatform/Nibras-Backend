const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
// تأكد إن المسارات دي صحيحة 100% حسب مشروعك
const Course = require("../modules/courses/models/course.model");
const User = require("../modules/users/models/user.model"); 

const beginnerCourses = [
  // --- CS Courses ---
  { courseCode: "CS103", title: "Mathematical Foundations of Computing", level: "Beginner", description: "Logic, proof techniques, sets, functions, and relations.", stats: { duration: "10 Weeks", hoursPerWeek: 12, enrolledStudents: 140, term: "Fall 2024" } },
  { courseCode: "CS106A", title: "Programming Methodology", level: "Beginner", description: "Introduction to the engineering of computer applications.", stats: { duration: "8 Weeks", hoursPerWeek: 11, enrolledStudents: 180, term: "Fall 2024" } },
  { courseCode: "CS106B", title: "Programming Abstractions", level: "Beginner", description: "Software engineering principles of data abstraction and modularity.", stats: { duration: "10 Weeks", hoursPerWeek: 14, enrolledStudents: 150, term: "Fall 2024" } },
  { courseCode: "CS106X", title: "Programming Abstractions (Accelerated)", level: "Beginner", description: "Accelerated version of CS106B for students with strong backgrounds.", stats: { duration: "10 Weeks", hoursPerWeek: 18, enrolledStudents: 80, term: "Fall 2024" } },
  { courseCode: "CS109", title: "Probability for Computer Scientists", level: "Beginner", description: "Probability theory and statistics for computer science.", stats: { duration: "10 Weeks", hoursPerWeek: 14, enrolledStudents: 130, term: "Fall 2024" } },
  
  // --- Math Courses ---
  { courseCode: "MATH18", title: "Foundations for Calculus", level: "Beginner", description: "Mathematical foundations and pre-calculus concepts.", stats: { duration: "10 Weeks", hoursPerWeek: 8, enrolledStudents: 100, term: "Fall 2024" } },
  { courseCode: "MATH19", title: "Calculus I", level: "Beginner", description: "Introduction to differential calculus.", stats: { duration: "10 Weeks", hoursPerWeek: 8, enrolledStudents: 200, term: "Fall 2024" } },
  { courseCode: "MATH20", title: "Calculus II", level: "Beginner", description: "Continuation of differential calculus and integral calculus.", stats: { duration: "10 Weeks", hoursPerWeek: 8, enrolledStudents: 190, term: "Winter 2025" } },
  { courseCode: "MATH21", title: "Calculus III", level: "Beginner", description: "Integrals, infinite series, and multivariable calculus.", stats: { duration: "10 Weeks", hoursPerWeek: 8, enrolledStudents: 170, term: "Spring 2025" } },
  { courseCode: "MATH51", title: "Linear Algebra & Multivariable Optimization", level: "Beginner", description: "Linear algebra and multivariable differential calculus.", stats: { duration: "10 Weeks", hoursPerWeek: 12, enrolledStudents: 160, term: "Fall 2024" } },
  { courseCode: "MATH52", title: "Integral Calculus of Several Variables", level: "Beginner", description: "Iterated integrals and vector calculus.", stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 110, term: "Winter 2025" } },
  { courseCode: "MATH53", title: "Ordinary Differential Equations", level: "Beginner", description: "Introduction to differential equations and applications.", stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 100, term: "Spring 2025" } },
  
  // --- Sciences Courses ---
  { courseCode: "PHYS41", title: "Mechanics", level: "Beginner", description: "Vectors, particle kinematics, energy, and momentum.", stats: { duration: "10 Weeks", hoursPerWeek: 9, enrolledStudents: 100, term: "Fall 2024" } },
  { courseCode: "PHYS43", title: "Electricity and Magnetism", level: "Beginner", description: "Charges, currents, and Maxwell's equations.", stats: { duration: "10 Weeks", hoursPerWeek: 9, enrolledStudents: 90, term: "Winter 2025" } },
  { courseCode: "BIO", title: "Introduction to Biology", level: "Beginner", description: "Foundational principles of biological systems.", stats: { duration: "8 Weeks", hoursPerWeek: 6, enrolledStudents: 120, term: "Spring 2025" } },
  { courseCode: "CHEM", title: "General Chemistry", level: "Beginner", description: "Atomic structure, chemical bonding, and stoichiometry.", stats: { duration: "8 Weeks", hoursPerWeek: 6, enrolledStudents: 110, term: "Fall 2024" } }
];

const intermediateCourses = [
  // --- CS Courses ---
  { courseCode: "CS107", title: "Computer Organization & Systems", level: "Intermediate", description: "Introduction to computer systems and low-level programming.", stats: { duration: "10 Weeks", hoursPerWeek: 15, enrolledStudents: 140, term: "Fall 2024" } },
  { courseCode: "CS110", title: "Principles of Computer Systems", level: "Intermediate", description: "Principles of computer systems, networking, and concurrency.", stats: { duration: "10 Weeks", hoursPerWeek: 16, enrolledStudents: 130, term: "Winter 2025" } },
  { courseCode: "CS157", title: "Computational Logic", level: "Intermediate", description: "Logic from a computational perspective and automated reasoning.", stats: { duration: "10 Weeks", hoursPerWeek: 12, enrolledStudents: 95, term: "Winter 2025" } },
  { courseCode: "CS161", title: "Design and Analysis of Algorithms", level: "Intermediate", description: "Fundamental principles of algorithm design and analysis.", stats: { duration: "10 Weeks", hoursPerWeek: 18, enrolledStudents: 120, term: "Fall 2024" } },
  { courseCode: "CS181", title: "Computers, Ethics, and Public Policy", level: "Intermediate", description: "Social framework of computing, ethics, and policy issues.", stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 95, term: "Spring 2025" } },
  { courseCode: "CS181W", title: "Computers, Ethics, and Public Policy (Writing)", level: "Intermediate", description: "Writing-intensive version of CS181.", stats: { duration: "10 Weeks", hoursPerWeek: 12, enrolledStudents: 60, term: "Spring 2025" } },
  { courseCode: "CS205L", title: "Continuous Mathematical Methods", level: "Intermediate", description: "Mathematical methods for robotics and graphics.", stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 70, term: "Fall 2024" } },
  
  // --- Engineering Courses ---
  { courseCode: "ENGR40M", title: "Introduction to Electronics", level: "Intermediate", description: "Foundational electronics and circuit design.", stats: { duration: "10 Weeks", hoursPerWeek: 12, enrolledStudents: 110, term: "Fall 2024" } },
  { courseCode: "ENGR76", title: "Information Science and Engineering", level: "Intermediate", description: "Principles of information processing and system engineering.", stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 85, term: "Winter 2025" } },
  
  // --- Math Courses (Upper Level) ---
  { courseCode: "MATH104", title: "Applied Linear Algebra", level: "Intermediate", description: "Practical applications of linear algebra in engineering.", stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 80, term: "Fall 2024" } },
  { courseCode: "MATH107", title: "Graph Theory", level: "Intermediate", description: "Study of graphs and their algorithms.", stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 60, term: "Spring 2025" } },
  { courseCode: "MATH108", title: "Introduction to Combinatorics", level: "Intermediate", description: "Counting techniques and combinatorial structures.", stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 55, term: "Winter 2025" } },
  { courseCode: "MATH109", title: "Applied Group Theory", level: "Intermediate", description: "Algebraic structures in computer science.", stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 50, term: "Fall 2024" } },
  { courseCode: "MATH110", title: "Applied Number Theory", level: "Intermediate", description: "Number theory for cryptography and security.", stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 65, term: "Spring 2025" } },
  { courseCode: "MATH113", title: "Linear Algebra and Matrix Theory", level: "Intermediate", description: "Linear transformations, matrices, and vector spaces.", stats: { duration: "10 Weeks", hoursPerWeek: 10, enrolledStudents: 85, term: "Spring 2025" } },
  
  // --- General/Humanities ---
  { courseCode: "PHIL251", title: "Philosophy of Mind", level: "Intermediate", description: "Philosophical foundations of intelligence.", stats: { duration: "10 Weeks", hoursPerWeek: 8, enrolledStudents: 40, term: "Fall 2024" } }
];

const seedCourses = async () => {
  const dbUrl = process.env.DATABASE_URL || process.env.MONGO_URI;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL is missing in .env!");
    process.exit(1);
  }

  try {
    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB");

    // نجيب الأدمن عشان نحطه كـ Instructor
    const adminUser = await User.findOne();
    if (!adminUser) {
      console.error("❌ No users found in DB!");
      process.exit(1);
    }

    await Course.deleteMany({});
    console.log("Cleared existing courses.");

    // دمج المصفوفات وإضافة الحقول الناقصة
    const allCourses = [...beginnerCourses, ...intermediateCourses].map(course => ({
      ...course,
      instructor: adminUser._id,
      instructorName: "AbdallahRT", // الاسم اللي كان في صورك
      category: course.courseCode.startsWith("MATH") ? "Math" : 
                course.courseCode.startsWith("PHYS") ? "Science" : 
                course.courseCode.startsWith("ENGR") ? "Engineering" : "Core",
      thumbnail: "default-course.jpg"
    }));

    await Course.insertMany(allCourses);
    console.log(`✅ Seed completed: ${allCourses.length} courses seeded successfully!`);

  } catch (error) {
    console.error("❌ Seed failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
};

seedCourses();