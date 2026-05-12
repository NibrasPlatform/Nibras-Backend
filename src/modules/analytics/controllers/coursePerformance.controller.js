const catchAsync = require("../../../core/utils/catchAsync");
const Course = require("../../courses/models/course.model");
const { getCoursePerformance } = require("../services/coursePerformance.service");

/**
 * GET /api/analytics/courses/:courseId/performance?topN=10
 *
 * Access control:
 *  - Super Admin and Admin may access any course.
 *  - Instructor may only access courses they own (course.instructor === req.user._id).
 *  - All other roles are forbidden.
 *
 * Query params:
 *  - topN {number} — leaderboard size (default 10, clamped to 1–50)
 */
const getCoursePerformanceHandler = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const topN = Math.min(Math.max(parseInt(req.query.topN, 10) || 10, 1), 50);

  const requestingUserId = String(req.user.id || req.user._id);
  const roleName = req.user.role?.name;

  // Fetch the course to verify it exists and check instructor ownership
  const course = await Course.findById(courseId)
    .select("instructor title courseCode")
    .lean();

  if (!course) {
    return res.status(404).json({
      success: false,
      message: "Course not found.",
    });
  }

  const isAdmin = ["Super Admin", "Admin"].includes(roleName);
  const isOwner =
    roleName === "Instructor" &&
    String(course.instructor) === requestingUserId;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({
      success: false,
      message:
        "Forbidden: only the course instructor, Admin, or Super Admin can access this dashboard.",
    });
  }

  const data = await getCoursePerformance(courseId, topN);

  return res.status(200).json({ success: true, data });
});

module.exports = { getCoursePerformanceHandler };
