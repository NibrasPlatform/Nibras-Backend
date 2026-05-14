const User = require("../../users/models/user.model");
const Achievement = require("../models/achievement.model");
const StudentAchievement = require("../models/studentAchievement.model");
const ActivityEvent = require("../models/activityEvent.model");
const Answer = require("../../community/models/answer.model");
const mongoose = require("mongoose");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const activityEventService = require("./activityEvent.service");
const leaderboardService = require("./leaderboard.service");

const SCORE_EVENT_GROUPS = Object.freeze({
  problem: ["problem_solved"],
  community: [
    "question_created",
    "answer_created",
    "accepted_answer",
    "question_upvote_received",
    "answer_upvote_received",
    "thread_created",
    "badge_awarded",
  ],
  contest: [
    "contest_joined",
    "contest_top_25",
    "contest_top_10",
    "contest_rating_gain",
  ],
  course: [
    "lesson_completed",
    "section_completed",
    "course_completed",
    "assignment_submitted",
    "assignment_approved",
    "high_grade",
    "daily_learning_activity",
    "learning_streak",
    "course_progress_bonus",
  ],
});

const toReputationPayload = (scores = {}) => ({
  total: Number(scores.totalScore || 0),
  breakdown: {
    problem: Number(scores.problemScore || 0),
    community: Number(scores.communityScore || 0),
    contest: Number(scores.contestScore || 0),
    course: Number(scores.courseScore || 0),
  },
});

const calculateUserScoreBreakdown = async (userId) => {
  const aggregates = await ActivityEvent.aggregate([
    { $match: { userId: mongoose.Types.ObjectId.createFromHexString(String(userId)) } },
    {
      $group: {
        _id: null,
        problemScore: {
          $sum: { $cond: [{ $in: ["$eventType", SCORE_EVENT_GROUPS.problem] }, "$points", 0] },
        },
        communityScore: {
          $sum: { $cond: [{ $in: ["$eventType", SCORE_EVENT_GROUPS.community] }, "$points", 0] },
        },
        contestScore: {
          $sum: { $cond: [{ $in: ["$eventType", SCORE_EVENT_GROUPS.contest] }, "$points", 0] },
        },
        courseScore: {
          $sum: { $cond: [{ $in: ["$eventType", SCORE_EVENT_GROUPS.course] }, "$points", 0] },
        },
      },
    },
  ]);

  const totals = aggregates[0] || {
    problemScore: 0,
    communityScore: 0,
    contestScore: 0,
    courseScore: 0,
  };
  const totalScore =
    Number(totals.problemScore || 0) +
    Number(totals.communityScore || 0) +
    Number(totals.contestScore || 0) +
    Number(totals.courseScore || 0);

  return {
    problemScore: Number(totals.problemScore || 0),
    communityScore: Number(totals.communityScore || 0),
    contestScore: Number(totals.contestScore || 0),
    courseScore: Number(totals.courseScore || 0),
    totalScore: Math.round(totalScore * 100) / 100,
  };
};

const syncUserReputationScore = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(String(userId))) {
    throw AppError.create("Invalid user id", status.BAD_REQUEST, "fail");
  }

  const breakdown = await calculateUserScoreBreakdown(userId);
  const reputation = toReputationPayload(breakdown);
  await User.findByIdAndUpdate(userId, {
    reputationScore: reputation.total,
    reputation,
  });
  return reputation;
};

const getUserReputationBreakdown = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(String(userId))) {
    throw AppError.create("Invalid user id", status.BAD_REQUEST, "fail");
  }

  const user = await User.findById(userId).select("reputation reputationScore");
  if (!user) {
    throw AppError.create("User not found", status.NOT_FOUND, "fail");
  }

  const hasSnapshot =
    Number.isFinite(Number(user?.reputation?.total)) &&
    user?.reputation?.breakdown &&
    ["problem", "community", "contest", "course"].every((key) =>
      Number.isFinite(Number(user.reputation.breakdown[key]))
    );

  if (hasSnapshot) {
    return {
      total: Number(user.reputation.total || 0),
      breakdown: {
        problem: Number(user.reputation.breakdown.problem || 0),
        community: Number(user.reputation.breakdown.community || 0),
        contest: Number(user.reputation.breakdown.contest || 0),
        course: Number(user.reputation.breakdown.course || 0),
      },
    };
  }

  return syncUserReputationScore(userId);
};

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
    await syncUserReputationScore(user._id);
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
  calculateUserScoreBreakdown,
  checkAndAwardBadges,
  getAllBadges,
  getLeaderboard,
  getLeaderboardConfig,
  getUserReputationBreakdown,
  getMyLeaderboardRank,
  syncUserReputationScore,
};
