const UserContestBookmark = require("../models/userContestBookmark.model");
const UserContestReminder = require("../models/userContestReminder.model");
const Contest = require("../models/contest.model");
const participationService = require("../services/userContestParticipation.service");

/**
 * Bookmark a contest
 */
const bookmarkContest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Check if contest exists
    const contest = await Contest.findById(id);
    if (!contest) {
      return res.status(404).json({
        status: 404,
        error: "Contest not found",
      });
    }

    // Check if already bookmarked
    const existing = await UserContestBookmark.findOne({
      userId,
      contestId: id,
    });

    if (existing) {
      await participationService.addParticipation(userId, contest, "bookmark");
      return res.status(400).json({
        status: 400,
        error: "Contest already bookmarked",
      });
    }

    // Create bookmark
    const bookmark = await UserContestBookmark.create({
      userId,
      contestId: id,
    });

    await participationService.addParticipation(userId, contest, "bookmark");

    res.status(201).json({
      status: 201,
      message: "Contest bookmarked successfully",
      data: bookmark,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

/**
 * Remove bookmark from a contest
 */
const unbookmarkContest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const bookmark = await UserContestBookmark.findOneAndDelete({
      userId,
      contestId: id,
    });

    if (!bookmark) {
      return res.status(404).json({
        status: 404,
        error: "Bookmark not found",
      });
    }

    res.status(200).json({
      status: 200,
      message: "Bookmark removed successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

/**
 * Get user's bookmarked contests
 */
const getBookmarkedContests = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookmarks = await UserContestBookmark.find({ userId })
      .populate("contestId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UserContestBookmark.countDocuments({ userId });

    const contests = bookmarks
      .filter((b) => b.contestId) // Filter out null contests (if deleted)
      .map((b) => ({
        ...b.contestId.toObject(),
        bookmarkedAt: b.createdAt,
      }));

    res.status(200).json({
      status: 200,
      data: {
        contests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

/**
 * Set a reminder for a contest
 */
const setReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Check if contest exists
    const contest = await Contest.findById(id);
    if (!contest) {
      return res.status(404).json({
        status: 404,
        error: "Contest not found",
      });
    }

    // Check if contest is still upcoming
    if (contest.status !== "upcoming") {
      return res.status(400).json({
        status: 400,
        error: "Can only set reminders for upcoming contests",
      });
    }

    // Check if reminder already exists
    const existing = await UserContestReminder.findOne({
      userId,
      contestId: id,
    });

    if (existing) {
      await participationService.addParticipation(userId, contest, "reminder");
      return res.status(400).json({
        status: 400,
        error: "Reminder already set for this contest",
      });
    }

    // Create reminder
    const reminder = await UserContestReminder.create({
      userId,
      contestId: id,
      reminderSent: false,
    });

    await participationService.addParticipation(userId, contest, "reminder");

    res.status(201).json({
      status: 201,
      message: "Reminder set successfully",
      data: reminder,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

/**
 * Remove reminder for a contest
 */
const removeReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const reminder = await UserContestReminder.findOneAndDelete({
      userId,
      contestId: id,
    });

    if (!reminder) {
      return res.status(404).json({
        status: 404,
        error: "Reminder not found",
      });
    }

    res.status(200).json({
      status: 200,
      message: "Reminder removed successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

/**
 * Get user's contest reminders
 */
const getReminders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reminders = await UserContestReminder.find({ userId })
      .populate("contestId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UserContestReminder.countDocuments({ userId });

    const contests = reminders
      .filter((r) => r.contestId) // Filter out null contests
      .map((r) => ({
        ...r.contestId.toObject(),
        reminderSet: r.createdAt,
        reminderSent: r.reminderSent,
      }));

    res.status(200).json({
      status: 200,
      data: {
        contests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

/**
 * Join/register intent for a contest
 */
const joinContest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const contest = await Contest.findById(id);
    if (!contest) {
      return res.status(404).json({
        status: 404,
        error: "Contest not found",
      });
    }

    const participation = await participationService.addParticipation(
      userId,
      contest,
      "manual"
    );

    res.status(200).json({
      status: 200,
      message: "Contest joined successfully",
      data: participation,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

/**
 * Get user's participation history
 */
const getParticipationHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { platform, from, to, page = 1, limit = 20 } = req.query;

    const { history, pagination } =
      await participationService.getUserParticipationHistory(userId, {
        platform,
        from,
        to,
        page,
        limit,
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

    res.status(200).json({
      status: 200,
      data,
      pagination,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

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
