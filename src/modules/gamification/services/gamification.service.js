const User = require("../../users/models/user.model");
const Achievement = require("../models/achievement.model");
const StudentAchievement = require("../models/studentAchievement.model");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

const checkAndAwardBadges = async (studentId) => {
  const user = await User.findById(studentId);
  if (!user) throw new AppError("User not found", status.NOT_FOUND);

  const allAchievements = await Achievement.find();
  const alreadyEarned = await StudentAchievement.find({ studentId }).select("achievementId");
  const earnedIds = alreadyEarned.map((a) => a.achievementId.toString());

  const newAwardedBadges = [];
  for (const achievement of allAchievements) {
    if (!earnedIds.includes(achievement._id.toString()) && criteriaMet(user, achievement)) {
      await StudentAchievement.create({
        studentId: user._id,
        achievementId: achievement._id,
      });
      user.reputationScore = (user.reputationScore || 0) + achievement.points;
      newAwardedBadges.push(achievement);
    }
  }

  if (newAwardedBadges.length > 0) {
    await user.save();
  }

  return newAwardedBadges;
};

const criteriaMet = (user, achievement) => {
  return false;
};

const getAllBadges = async () => Achievement.find().sort({ points: -1, name: 1 });

module.exports = { checkAndAwardBadges, getAllBadges };
