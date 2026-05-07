const User = require("../../users/models/user.model");
const Course = require("../../courses/models/course.model");
const Activity = require("../../gamification/models/activity.model");
const Project = require("../models/project.model");
const Deadline = require("../models/deadline.model");
const Achievement = require("../../gamification/models/achievement.model");

const getDashboardData = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const user = await User.findById(studentId).populate("role");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [courses, activities, projects, deadlines, achievements] = await Promise.all([
      Course.find({ instructor: studentId }).select("-createdAt -updatedAt -__v"),
      Activity.find({ studentId }).select("-createdAt -updatedAt -__v"),
      Project.find({ studentId }).select("-createdAt -updatedAt -__v"),
      Deadline.find({ studentId }).select("-createdAt -updatedAt -__v"),
      Achievement.find().select("-createdAt -updatedAt -__v"),
    ]);

    res.status(200).json({
      success: true,
      data: {
        studentStats: {
          name: user.name,
          role: user.role?.name || null,
          reputation: user.reputationScore,
          contestRating: user.contestRating,
          problemsSolved: user.problemsSolved,
          studyStreak: user.studyStreak,
        },
        coursesProgress: {
          totalEnrolled: courses.length,
          courses,
        },
        recentActivities: activities,
        activeProjects: projects,
        deadlines,
        achievements,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardData,
};
