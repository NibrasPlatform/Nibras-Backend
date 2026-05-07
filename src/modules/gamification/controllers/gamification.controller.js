const catchAsync = require("../../../core/utils/catchAsync");
const gamificationService = require("../services/gamification.service");

const checkAndAwardBadges = catchAsync(async (req, res) => {
  const studentId = req.body.studentId || req.user?._id;
  const badges = await gamificationService.checkAndAwardBadges(studentId);
  res.status(200).json({ success: true, message: "Badges checked and awarded successfully", data: badges });
});

const getAllBadges = catchAsync(async (req, res) => {
  const badges = await gamificationService.getAllBadges();
  res.status(200).json({ success: true, message: "Badges fetched successfully", data: badges });
});

const getLeaderboard = catchAsync(async (req, res) => {
  const data = await gamificationService.getLeaderboard({
    period: req.query.period,
    scope: req.query.scope,
    courseId: req.query.courseId,
    page: req.query.page,
    limit: req.query.limit,
    userId: req.user?._id,
  });
  res.status(200).json({ success: true, message: "Leaderboard fetched successfully", data });
});

const getMyLeaderboardRank = catchAsync(async (req, res) => {
  const data = await gamificationService.getMyLeaderboardRank({
    period: req.query.period,
    scope: req.query.scope,
    courseId: req.query.courseId,
    userId: req.user?._id,
  });
  res.status(200).json({ success: true, message: "Leaderboard rank fetched successfully", data });
});

const getLeaderboardConfig = catchAsync(async (req, res) => {
  const data = await gamificationService.getLeaderboardConfig();
  res.status(200).json({ success: true, message: "Leaderboard config fetched successfully", data });
});

module.exports = {
  checkAndAwardBadges,
  getAllBadges,
  getLeaderboard,
  getLeaderboardConfig,
  getMyLeaderboardRank,
};
