const Contest = require("../models/contest.model");
const UserContestBookmark = require("../models/userContestBookmark.model");
const contestSyncService = require("../services/contestSync.service");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

/**
 * Get all contests with filtering and pagination
 */
const getContests = async (req, res) => {
  try {
    const {
      platform,
      status: contestStatus,
      bookmarked,
      page = 1,
      limit = 20,
      sortBy = "startTime",
      order = "asc",
    } = req.query;

    // Build filter query
    const filter = {};

    if (platform) {
      filter.platform = platform.toLowerCase();
    }

    if (contestStatus) {
      filter.status = contestStatus;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "desc" ? -1 : 1;

    // If bookmarked filter is requested, need to join with bookmarks
    if (bookmarked === "true" && req.user) {
      const bookmarks = await UserContestBookmark.find({
        userId: req.user._id,
      }).select("contestId");

      const bookmarkedContestIds = bookmarks.map((b) => b.contestId);
      filter._id = { $in: bookmarkedContestIds };
    }

    // Fetch contests
    const contests = await Contest.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Contest.countDocuments(filter);

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
 * Get a single contest by ID
 */
const getContestById = async (req, res) => {
  try {
    const { id } = req.params;

    const contest = await Contest.findById(id);

    if (!contest) {
      return res.status(404).json({
        status: 404,
        error: "Contest not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: contest,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

/**
 * Manually trigger contest sync (admin only)
 */
const syncContests = async (req, res) => {
  try {
    const { platform , status } = req.body;

    let results;
    if (platform) {
      // Sync specific platform
      results = await contestSyncService.syncPlatform(platform, status);
    } else {
      // Sync all platforms
      results = await contestSyncService.syncAllContests();
    }

    res.status(200).json({
      status: 200,
      message: "Contest sync completed",
      data: results,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

/**
 * Update contest statuses (admin only)
 */
const updateStatuses = async (req, res) => {
  try {
    const results = await contestSyncService.updateContestStatuses();

    res.status(200).json({
      status: 200,
      message: "Contest statuses updated",
      data: results,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

module.exports = {
  getContests,
  getContestById,
  syncContests,
  updateStatuses,
};
