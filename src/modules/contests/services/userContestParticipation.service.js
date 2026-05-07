const UserContestParticipation = require("../models/userContestParticipation.model");
const Contest = require("../models/contest.model");
const activityEventService = require("../../gamification/services/activityEvent.service");

const addParticipation = async (userId, contest, source) => {
  const now = new Date();
  try {
    const participation = await UserContestParticipation.findOneAndUpdate(
      {
        userId,
        contestId: contest._id,
      },
      {
        $setOnInsert: {
          userId,
          contestId: contest._id,
          joinedAt: now,
        },
        $set: {
          platform: contest.platform,
          contestName: contest.title,
          startTime: contest.startTime,
          source,
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );
    await activityEventService.recordContestJoined({
      userId,
      contestId: contest._id,
      occurredAt: participation.joinedAt || now,
    });
    return participation;
  } catch (error) {
    if (error?.code === 11000) {
      return UserContestParticipation.findOne({
        userId,
        contestId: contest._id,
      });
    }
    throw error;
  }
};

const getUserParticipationHistory = async (userId, filters = {}) => {
  const {
    platform,
    from,
    to,
    page = 1,
    limit = 20,
  } = filters;

  const query = { userId };

  if (platform) {
    query.platform = platform.toLowerCase();
  }

  if (from || to) {
    query.startTime = {};
    if (from) {
      query.startTime.$gte = new Date(from);
    }
    if (to) {
      query.startTime.$lte = new Date(to);
    }
  }

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  const [history, total] = await Promise.all([
    UserContestParticipation.find(query)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limitNumber),
    UserContestParticipation.countDocuments(query),
  ]);

  return {
    history,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const updateResult = async (userId, contestId, { rank, ratingChange }) => {
  const updates = {};
  if (rank !== undefined) {
    updates.rank = rank;
  }
  if (ratingChange !== undefined) {
    updates.ratingChange = ratingChange;
  }

  const participation = await UserContestParticipation.findOneAndUpdate(
    {
      userId,
      contestId,
    },
    {
      $set: updates,
    },
    {
      returnDocument: 'after',
      runValidators: true,
    }
  );

  if (!participation) {
    return null;
  }

  const contest = await Contest.findById(contestId).select("participantsCount");
  const participantsCount = Number(contest?.participantsCount || 0);
  const finalRank = Number(rank != null ? rank : participation.rank || 0);
  if (participantsCount > 0 && finalRank > 0) {
    const percentile = finalRank / participantsCount;
    if (percentile <= 0.1) {
      await activityEventService.recordContestPlacement({
        userId,
        contestId,
        bucket: "top_10",
        occurredAt: new Date(),
      });
    } else if (percentile <= 0.25) {
      await activityEventService.recordContestPlacement({
        userId,
        contestId,
        bucket: "top_25",
        occurredAt: new Date(),
      });
    }
  }

  if (Number(ratingChange || 0) > 0) {
    await activityEventService.recordContestRatingGain({
      userId,
      contestId,
      ratingChange,
      occurredAt: new Date(),
    });
  }

  return participation;
};

module.exports = {
  addParticipation,
  getUserParticipationHistory,
  updateResult,
};
