const express = require("express");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const controller = require("../controllers/analytics.controller");
const { getStudentPerformance } = require("../controllers/studentPerformance.controller");
const { getCoursePerformanceHandler } = require("../controllers/coursePerformance.controller");

const router = express.Router();

// ── Existing ──────────────────────────────────────────────────────────────────
router.get("/dashboard/:studentId", authenticate, controller.getDashboardData);

// ── Student Performance Dashboard ─────────────────────────────────────────────
// GET /api/analytics/student-performance/:studentId
// Students can view their own; Instructors/Admins can view any student.
router.get("/student-performance/:studentId", authenticate, getStudentPerformance);

// ── Course Performance Dashboard ──────────────────────────────────────────────
// GET /api/analytics/courses/:courseId/performance?topN=10
// Only the course instructor, Admin, or Super Admin may access this.
router.get("/courses/:courseId/performance", authenticate, getCoursePerformanceHandler);

module.exports = router;
