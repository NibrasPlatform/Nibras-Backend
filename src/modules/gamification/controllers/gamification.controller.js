const gamificationService = require("../services/gamification.service");

const checkAndAwardBadges = async (req, res, next) => {
  try {
    const studentId = req.body.studentId || req.user?._id;
    const badges = await gamificationService.checkAndAwardBadges(studentId);
    res.status(200).json({ success: true, data: badges });
  } catch (error) {
    next(error);
  }
};

const getAllBadges = async (req, res, next) => {
  try {
    const badges = await gamificationService.getAllBadges();
    res.status(200).json({ success: true, data: badges });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkAndAwardBadges,
  getAllBadges,
};
