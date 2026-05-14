const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const Contest = require("../models/contest.model");
const UserContestBookmark = require("../models/userContestBookmark.model");
const contestSyncService = require("../services/contestSync.service");

const getContests = catchAsync(async (req, res) => {
  const {
    platform,
    status: contestStatus,
    bookmarked,
    page = 1,
    limit = 20,
    sortBy = "startTime",
    order = "asc",
  } = req.query;

  const filter = {};
  if (platform) filter.platform = platform.toLowerCase();
  if (contestStatus) filter.status = contestStatus;

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;
  const sortOrder = order === "desc" ? -1 : 1;

  if (bookmarked === "true" && req.user) {
    const bookmarks = await UserContestBookmark.find({ userId: req.user._id }).select("contestId").lean();
    filter._id = { $in: bookmarks.map((b) => b.contestId) };
  }

  const [contests, total] = await Promise.all([
    Contest.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limitNum).lean(),
    Contest.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    message: "Contests fetched successfully",
    data: {
      contests,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 },
    },
  });
});

const getContestById = catchAsync(async (req, res) => {
  const contest = await Contest.findById(req.params.id).lean();
  if (!contest) throw AppError.create("Contest not found", 404, "fail");
  res.status(200).json({ success: true, message: "Contest fetched successfully", data: contest });
});

const syncContests = catchAsync(async (req, res) => {
  const { platform, status } = req.body;
  const results = platform
    ? await contestSyncService.syncPlatform(platform, status)
    : await contestSyncService.syncAllContests();
  res.status(200).json({ success: true, message: "Contest sync completed", data: results });
});

const updateStatuses = catchAsync(async (req, res) => {
  const results = await contestSyncService.updateContestStatuses();
  res.status(200).json({ success: true, message: "Contest statuses updated", data: results });
});

module.exports = { getContests, getContestById, syncContests, updateStatuses };
