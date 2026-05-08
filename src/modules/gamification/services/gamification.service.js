const User = require("../../users/models/user.model");
const Achievement = require("../models/achievement.model");
const StudentAchievement = require("../models/studentAchievement.model");
const Answer = require("../../community/models/answer.model");
const mongoose = require("mongoose");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const activityEventService = require("./activityEvent.service");
const leaderboardService = require("./leaderboard.service");

const checkAndAwardBadges = async (studentId) => {
  const user = await User.findById(studentId);
  if (!user) throw AppError.create("User not found", 404, "fail");

  const allAchievements = await Achievement.find();
  const alreadyEarned = await StudentAchievement.find({ studentId }).select("achievementId");
  const earnedIds = alreadyEarned.map((a) => a.achievementId.toString());

  // Pre-fetch answer count once to avoid N+1 queries inside the loop
  const answersCount = await Answer.countDocuments({ author: user._id });

  const newAwardedBadges = [];
  for (const achievement of allAchievements) {
    if (!earnedIds.includes(achievement._id.toString()) && criteriaMet(user, achievement, answersCount)) {
      await StudentAchievement.create({
        studentId: user._id,
        achievementId: achievement._id,
      });
      user.reputationScore = (user.reputationScore || 0) + achievement.points;
      await activityEventService.recordBadgeAwarded({
        userId: user._id,
        achievementId: achievement._id,
        occurredAt: new Date(),
        roleSnapshot: user.role?.name || null,
      });
      newAwardedBadges.push(achievement);
    }
  }

  if (newAwardedBadges.length > 0) {
    await user.save();
  }

  return newAwardedBadges;
};

// answersCount is pre-fetched once before the loop — no per-achievement DB calls
const criteriaMet = (user, achievement, answersCount = 0) => {
  const normalizedName = String(achievement?.name || "").trim().toLowerCase();
  const normalizedDescription = String(achievement?.description || "").trim().toLowerCase();

  if (normalizedName.includes("first steps") || normalizedDescription.includes("first assignment")) {
    return Number(user?.problemsSolved || 0) > 0 || Number(user?.reputationScore || 0) > 0;
  }

  if (normalizedName.includes("problem solver") || normalizedDescription.includes("solve 10 coding problems")) {
    return Number(user?.problemsSolved || 0) >= 10;
  }

  if (normalizedName.includes("7-day streak") || normalizedDescription.includes("7 day streak")) {
    return Number(user?.studyStreak || 0) >= 7;
  }

  if (normalizedName.includes("team player") || normalizedDescription.includes("help 5 classmates")) {
    return answersCount >= 5;
  }

  if (normalizedName.includes("top contributor") || normalizedDescription.includes("top contributor")) {
    return answersCount >= 10 || Number(user?.reputationScore || 0) >= 100;
  }

  return false;
};

const getAllBadges = async () => Achievement.find().sort({ points: -1, name: 1 });

const assertLeaderboardFilters = ({ period, scope, courseId }) => {
  if (!["weekly", "monthly", "all-time"].includes(period)) {
    throw AppError.create("period must be weekly, monthly, or all-time", 400, "fail");
  }
  if (!["global", "course"].includes(scope)) {
    throw AppError.create("scope must be global or course", 400, "fail");
  }
  if (scope === "course" && !courseId) {
    throw AppError.create("courseId is required for course scope", 400, "fail");
  }
  if (scope === "course" && !mongoose.Types.ObjectId.isValid(String(courseId))) {
    throw AppError.create("courseId must be a valid ObjectId", 400, "fail");
  }
};

const getLeaderboard = async ({ period = "weekly", scope = "global", courseId = null, page = 1, limit = 20, userId }) => {
  assertLeaderboardFilters({ period, scope, courseId });
  return leaderboardService.listLeaderboard({
    period,
    scope,
    courseId,
    page,
    limit,
    userId,
  });
};

const getMyLeaderboardRank = async ({ period = "weekly", scope = "global", courseId = null, userId }) => {
  assertLeaderboardFilters({ period, scope, courseId });
  return leaderboardService.getMyRank({ period, scope, courseId, userId });
};

const getLeaderboardConfig = async () => leaderboardService.getConfig();

module.exports = {
  checkAndAwardBadges,
  getAllBadges,
  getLeaderboard,
  getLeaderboardConfig,
  getMyLeaderboardRank,
};
