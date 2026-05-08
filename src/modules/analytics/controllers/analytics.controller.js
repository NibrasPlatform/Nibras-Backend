const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const User = require("../../users/models/user.model");
const Course = require("../../courses/models/course.model");
const Activity = require("../../gamification/models/activity.model");
const Project = require("../models/project.model");
const Deadline = require("../models/deadline.model");
const Achievement = require("../../gamification/models/achievement.model");

const getDashboardData = catchAsync(async (req, res) => {
  const { studentId } = req.params;
  const user = await User.findById(studentId).populate("role").lean();
  if (!user) throw AppError.create("User not found", 404, "fail");

  const [courses, activities, projects, deadlines, achievements] = await Promise.all([
    Course.find({ instructor: studentId }).select("-createdAt -updatedAt -__v").lean(),
    Activity.find({ studentId }).select("-createdAt -updatedAt -__v").lean(),
    Project.find({ studentId }).select("-createdAt -updatedAt -__v").lean(),
    Deadline.find({ studentId }).select("-createdAt -updatedAt -__v").lean(),
    Achievement.find().select("-createdAt -updatedAt -__v").lean(),
  ]);

  res.status(200).json({
    success: true,
    message: "Dashboard data fetched successfully",
    data: {
      studentStats: {
        name: user.name,
        role: user.role?.name || null,
        reputation: user.reputationScore,
        contestRating: user.contestRating,
        problemsSolved: user.problemsSolved,
        studyStreak: user.studyStreak,
      },
      coursesProgress: { totalEnrolled: courses.length, courses },
      recentActivities: activities,
      activeProjects: projects,
      deadlines,
      achievements,
    },
  });
});

module.exports = { getDashboardData };
