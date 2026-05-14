const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const UserContestBookmark = require("../models/userContestBookmark.model");
const UserContestReminder = require("../models/userContestReminder.model");
const Contest = require("../models/contest.model");
const participationService = require("../services/userContestParticipation.service");

const bookmarkContest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const contest = await Contest.findById(id).lean();
  if (!contest) throw AppError.create("Contest not found", 404, "fail");

  const existing = await UserContestBookmark.findOne({ userId, contestId: id });
  if (existing) {
    await participationService.addParticipation(userId, contest, "bookmark");
    throw AppError.create("Contest already bookmarked", 400, "fail");
  }

  const bookmark = await UserContestBookmark.create({ userId, contestId: id });
  await participationService.addParticipation(userId, contest, "bookmark");

  res.status(201).json({ success: true, message: "Contest bookmarked successfully", data: bookmark });
});

const unbookmarkContest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const bookmark = await UserContestBookmark.findOneAndDelete({ userId, contestId: id });
  if (!bookmark) throw AppError.create("Bookmark not found", 404, "fail");

  res.status(200).json({ success: true, message: "Bookmark removed successfully" });
});

const getBookmarkedContests = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const pageNum = Math.max(Number(req.query.page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [bookmarks, total] = await Promise.all([
    UserContestBookmark.find({ userId })
      .populate("contestId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    UserContestBookmark.countDocuments({ userId }),
  ]);

  const contests = bookmarks
    .filter((b) => b.contestId)
    .map((b) => ({ ...b.contestId.toObject(), bookmarkedAt: b.createdAt }));

  res.status(200).json({
    success: true,
    message: "Bookmarked contests fetched successfully",
    data: {
      contests,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 },
    },
  });
});

const setReminder = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const contest = await Contest.findById(id).lean();
  if (!contest) throw AppError.create("Contest not found", 404, "fail");
  if (contest.status !== "upcoming") throw AppError.create("Can only set reminders for upcoming contests", 400, "fail");

  const existing = await UserContestReminder.findOne({ userId, contestId: id });
  if (existing) {
    await participationService.addParticipation(userId, contest, "reminder");
    throw AppError.create("Reminder already set for this contest", 400, "fail");
  }

  const reminder = await UserContestReminder.create({ userId, contestId: id, reminderSent: false });
  await participationService.addParticipation(userId, contest, "reminder");

  res.status(201).json({ success: true, message: "Reminder set successfully", data: reminder });
});

const removeReminder = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const reminder = await UserContestReminder.findOneAndDelete({ userId, contestId: id });
  if (!reminder) throw AppError.create("Reminder not found", 404, "fail");

  res.status(200).json({ success: true, message: "Reminder removed successfully" });
});

const getReminders = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const pageNum = Math.max(Number(req.query.page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [reminders, total] = await Promise.all([
    UserContestReminder.find({ userId })
      .populate("contestId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    UserContestReminder.countDocuments({ userId }),
  ]);

  const contests = reminders
    .filter((r) => r.contestId)
    .map((r) => ({ ...r.contestId.toObject(), reminderSet: r.createdAt, reminderSent: r.reminderSent }));

  res.status(200).json({
    success: true,
    message: "Reminders fetched successfully",
    data: {
      contests,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 },
    },
  });
});

const joinContest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const contest = await Contest.findById(id).lean();
  if (!contest) throw AppError.create("Contest not found", 404, "fail");

  const participation = await participationService.addParticipation(userId, contest, "manual");
  res.status(200).json({ success: true, message: "Contest joined successfully", data: participation });
});

const getParticipationHistory = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { platform, from, to, page, limit } = req.query;

  const { history, pagination } = await participationService.getUserParticipationHistory(userId, {
    platform, from, to, page, limit,
  });

  const data = history.map((entry) => ({
    contestName: entry.contestName,
    platform: entry.platform,
    startTime: entry.startTime,
    rank: entry.rank,
    ratingChange: entry.ratingChange,
    joinedAt: entry.joinedAt,
    source: entry.source,
    contestId: entry.contestId,
  }));

  res.status(200).json({ success: true, message: "Participation history fetched successfully", data, pagination });
});

module.exports = {
  bookmarkContest,
  unbookmarkContest,
  getBookmarkedContests,
  setReminder,
  removeReminder,
  getReminders,
  joinContest,
  getParticipationHistory,
};
