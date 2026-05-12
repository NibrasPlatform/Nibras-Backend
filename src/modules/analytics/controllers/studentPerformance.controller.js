const catchAsync = require("../../../core/utils/catchAsync");
const { getStudentPerformanceDashboard } = require("../services/studentPerformance.service");

/**
 * GET /api/analytics/student-performance/:studentId
 *
 * Access control:
 *  - Students may only fetch their own dashboard.
 *  - Instructors, Admins, and Super Admins may fetch any student's dashboard.
 */
const getStudentPerformance = catchAsync(async (req, res) => {
  const { studentId } = req.params;
  const requestingUserId = String(req.user.id || req.user._id);
  const roleName = req.user.role?.name;

  const isPrivileged = ["Super Admin", "Admin", "Instructor"].includes(roleName);

  if (!isPrivileged && requestingUserId !== studentId) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: you can only view your own performance dashboard.",
    });
  }

  const data = await getStudentPerformanceDashboard(studentId);

  return res.status(200).json({ success: true, data });
});

module.exports = { getStudentPerformance };
