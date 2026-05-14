const mongoose = require("mongoose");
const AppError = require("../../../core/utils/errorHandler");
const MentorProfile = require("../models/mentorProfile.model");
const Tag = require("../../community/models/tag.model");
const Question = require("../../community/models/question.model");
const Answer = require("../../community/models/answer.model");
const UserProblemProgress = require("../../problems/models/userProblemProgress.model");
const Problem = require("../../problems/models/problem.model");
const ActivityEvent = require("../../gamification/models/activityEvent.model");
const User = require("../../users/models/user.model");
const {
  getProblemDifficultyWeight,
} = require("../../gamification/utils/scoring.util");

const logger = require("../../../core/utils/logger");

const DAY_MS = 24 * 60 * 60 * 1000;
const suggestionsCache = new Map();
const MATCH_MODEL_VERSION = "activity_match_v1";
const ACTIVE_MENTOR_WINDOW_DAYS = 30;

const normalizeLimit = (limit) => Math.min(Math.max(Number(limit) || 3, 1), 10);

const incrementVector = (vector, key, weight) => {
  if (!key || !weight) return;
  vector[key] = (vector[key] || 0) + weight;
};

const cosineSimilarity = (left, right) => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  if (keys.size === 0) return 0;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  keys.forEach((key) => {
    const leftValue = Number(left[key] || 0);
    const rightValue = Number(right[key] || 0);
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  });

  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const topSharedTags = (left, right, limit = 3) =>
  [...new Set(Object.keys(left).filter((tag) => Object.prototype.hasOwnProperty.call(right, tag)))]
    .sort((a, b) => ((right[b] || 0) + (left[b] || 0)) - ((right[a] || 0) + (left[a] || 0)))
    .slice(0, limit);

const getTopVectorKeys = (vector, limit = 3) =>
  Object.entries(vector || {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key]) => key);

const getConfidence = (score) => {
  const normalized = Number(score || 0);
  if (normalized >= 75) return "high";
  if (normalized >= 50) return "medium";
  return "low";
};

const buildReasonSummary = ({
  hasStudentSignal,
  sharedTags = [],
  recentActivityScore = 0,
  helpfulnessScore = 0,
  availability = "open",
}) => {
  if (hasStudentSignal && sharedTags.length > 0) {
    return `Strong overlap in ${sharedTags.join(", ")} with recent activity ${recentActivityScore}/100, helpfulness ${helpfulnessScore}/100, and ${availability} availability.`;
  }

  if (hasStudentSignal) {
    return `Matched from your recent activity profile with activity ${recentActivityScore}/100, helpfulness ${helpfulnessScore}/100, and ${availability} availability.`;
  }

  return `Recommended from recent mentor activity ${recentActivityScore}/100, helpfulness ${helpfulnessScore}/100, and ${availability} availability while your topic signal builds up.`;
};

class MentorshipService {
  getCacheKey(userId, limit) {
    return `${userId}:${limit}`;
  }

  getCachedSuggestions(userId, limit) {
    const cacheKey = this.getCacheKey(userId, limit);
    const cached = suggestionsCache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      suggestionsCache.delete(cacheKey);
      return null;
    }
    return cached.value;
  }

  setCachedSuggestions(userId, limit, value, ttlMs = 6 * 60 * 60 * 1000) {
    suggestionsCache.set(this.getCacheKey(userId, limit), {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clearUserCache(userId) {
    [...suggestionsCache.keys()]
      .filter((key) => key.startsWith(`${userId}:`))
      .forEach((key) => suggestionsCache.delete(key));
  }

  async updateMyProfile(user, payload = {}) {
    const roleName = String(user?.role?.name || user?.role || "");
    if (roleName !== "Instructor" && roleName !== "TA") {
      throw AppError.create("Only instructors and TAs can manage mentor profiles.", 403, "fail");
    }

    const existingProfile = await MentorProfile.findOne({ userId: user._id }).lean();
    const hasFocusTagIds = Object.prototype.hasOwnProperty.call(payload, "focusTagIds");
    const focusTagIds = Array.isArray(payload.focusTagIds)
      ? [...new Set(payload.focusTagIds.map((id) => String(id)).filter(Boolean))]
      : [];
    const validTags = focusTagIds.length
      ? await Tag.find({ _id: { $in: focusTagIds } }).select("_id").lean()
      : [];
    const validTagIds = validTags.map((tag) => tag._id);

    const updates = {
      roleType: roleName,
      optIn: Boolean(payload.optIn),
      availability: ["open", "limited", "paused"].includes(payload.availability) ? payload.availability : "open",
      bio: payload.bio != null ? String(payload.bio).trim() || null : existingProfile?.bio || null,
      focusTags: hasFocusTagIds ? validTagIds : (existingProfile?.focusTags || []),
    };

    if (updates.optIn && !existingProfile?.optIn) {
      updates.status = "pending";
      updates.approvedBy = null;
      updates.approvedAt = null;
    }

    const profile = await MentorProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: updates, $setOnInsert: { userId: user._id } },
      { upsert: true, new: true },
    )
      .populate("focusTags", "name")
      .lean();

    this.clearUserCache(user._id);
    return profile;
  }

  async listProfiles(filters = {}) {
    const query = {};
    if (filters.status) {
      query.status = filters.status;
    }

    return MentorProfile.find(query)
      .sort({ updatedAt: -1 })
      .populate("userId", "name email role")
      .populate({
        path: "userId",
        populate: { path: "role", select: "name" },
      })
      .populate("focusTags", "name")
      .populate("approvedBy", "name email")
      .lean();
  }

  async setProfileStatus(userId, status, actorId) {
    const updates = {
      status,
      approvedBy: actorId,
      approvedAt: status === "approved" ? new Date() : null,
    };

    return MentorProfile.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true },
    )
      .populate("userId", "name email role")
      .populate({
        path: "userId",
        populate: { path: "role", select: "name" },
      })
      .populate("focusTags", "name")
      .lean();
  }

  async updateAvailability(userId, availability) {
    return MentorProfile.findOneAndUpdate(
      { userId },
      { $set: { availability } },
      { new: true },
    )
      .populate("userId", "name email role")
      .populate({
        path: "userId",
        populate: { path: "role", select: "name" },
      })
      .populate("focusTags", "name")
      .lean();
  }

  async buildStudentVector(userId) {
    const since = new Date(Date.now() - 90 * DAY_MS);
    const vector = {};

    const [questionDocs, answerDocs, solvedProgress] = await Promise.all([
      Question.find({ author: userId, createdAt: { $gte: since } })
        .populate("tags", "name")
        .select("tags")
        .lean(),
      Answer.find({ author: userId, createdAt: { $gte: since } })
        .populate({
          path: "question",
          select: "tags",
          populate: { path: "tags", select: "name" },
        })
        .select("question")
        .lean(),
      UserProblemProgress.find({ userId, solved: true, solvedAt: { $gte: since } })
        .select("problemId")
        .lean(),
    ]);

    questionDocs.forEach((question) => {
      (question.tags || []).forEach((tag) => incrementVector(vector, tag.name, 3));
    });

    answerDocs.forEach((answer) => {
      (answer.question?.tags || []).forEach((tag) => incrementVector(vector, tag.name, 2));
    });

    const problemIds = solvedProgress.map((entry) => entry.problemId);
    if (problemIds.length) {
      const problems = await Problem.find({ _id: { $in: problemIds } })
        .select("tags difficulty")
        .lean();
      problems.forEach((problem) => {
        const weight = getProblemDifficultyWeight(problem.difficulty);
        (problem.tags || []).forEach((tag) => incrementVector(vector, tag, weight));
      });
    }

    return vector;
  }

  async buildMentorVector(profile) {
    const since = new Date(Date.now() - 90 * DAY_MS);
    const vector = {};

    const [answers, solvedProgress] = await Promise.all([
      Answer.find({ author: profile.userId, createdAt: { $gte: since } })
        .populate({
          path: "question",
          select: "tags",
          populate: { path: "tags", select: "name" },
        })
        .select("question isAccepted")
        .lean(),
      UserProblemProgress.find({ userId: profile.userId, solved: true, solvedAt: { $gte: since } })
        .select("problemId")
        .lean(),
    ]);

    answers.forEach((answer) => {
      (answer.question?.tags || []).forEach((tag) => incrementVector(vector, tag.name, 5));
      if (answer.isAccepted) {
        (answer.question?.tags || []).forEach((tag) => incrementVector(vector, tag.name, 3));
      }
    });

    const problemIds = solvedProgress.map((entry) => entry.problemId);
    if (problemIds.length) {
      const problems = await Problem.find({ _id: { $in: problemIds } })
        .select("tags difficulty")
        .lean();
      problems.forEach((problem) => {
        const weight = getProblemDifficultyWeight(problem.difficulty);
        (problem.tags || []).forEach((tag) => incrementVector(vector, tag, weight));
      });
    }

    (profile.focusTags || []).forEach((tag) => incrementVector(vector, tag.name, 4));

    return vector;
  }

  async getActivityStats(userId) {
    const recentSince = new Date(Date.now() - 30 * DAY_MS);
    const helpfulSince = new Date(Date.now() - 90 * DAY_MS);

    const [recentEvents, helpfulEvents] = await Promise.all([
      ActivityEvent.find({ userId, occurredAt: { $gte: recentSince } })
        .select("occurredAt")
        .sort({ occurredAt: -1 })
        .lean(),
      ActivityEvent.find({
        userId,
        occurredAt: { $gte: helpfulSince },
        eventType: {
          $in: ["answer_created", "accepted_answer", "answer_upvote_received", "question_upvote_received"],
        },
      })
        .select("points")
        .lean(),
    ]);

    const recentDayCount = new Set(recentEvents.map((event) => event.occurredAt.toISOString().slice(0, 10))).size;
    const recentActivityScore = Math.min((recentDayCount * 8) + (recentEvents.length * 3), 100);
    const helpfulnessScore = Math.min(
      helpfulEvents.reduce((sum, event) => sum + Number(event.points || 0), 0),
      100,
    );

    return {
      recentEventsCount: recentEvents.length,
      recentActiveDays: recentDayCount,
      recentActivityScore,
      helpfulnessScore,
      lastActivityAt: recentEvents.length ? recentEvents[0].occurredAt : null,
    };
  }

  async getSuggestionsForUser(userId, limit = 3, options = {}) {
    const normalizedLimit = normalizeLimit(limit);
    if (!options.skipCache) {
      const cached = this.getCachedSuggestions(userId, normalizedLimit);
      if (cached) return cached;
    }

    const since = new Date(Date.now() - ACTIVE_MENTOR_WINDOW_DAYS * DAY_MS);
    const [student, profiles] = await Promise.all([
      User.findById(userId).populate("role").lean(),
      MentorProfile.find({
        optIn: true,
        status: "approved",
        availability: { $ne: "paused" },
      })
        .populate("focusTags", "name")
        .populate("userId", "name role")
        .populate({
          path: "userId",
          populate: { path: "role", select: "name" },
        })
        .lean(),
    ]);

    if (!student) {
      throw AppError.create("User not found.", 404, "fail");
    }

    const studentVector = await this.buildStudentVector(userId);
    const hasStudentSignal = Object.keys(studentVector).length > 0;
    const studentTopTags = getTopVectorKeys(studentVector, 3);
    const recentActiveMentorIds = new Set(
      (await ActivityEvent.distinct("userId", { occurredAt: { $gte: since } })).map((id) => String(id)),
    );

    const scored = [];
    for (const profile of profiles) {
      const mentorId = String(profile.userId?._id || profile.userId);
      if (mentorId === String(userId) || !recentActiveMentorIds.has(mentorId)) {
        continue;
      }

      const mentorVector = await this.buildMentorVector(profile);
      const activityStats = await this.getActivityStats(profile.userId._id || profile.userId);
      const topicFit = hasStudentSignal ? Math.round(cosineSimilarity(studentVector, mentorVector) * 100) : 0;
      const availabilityScore = profile.availability === "open" ? 100 : 70;
      const sharedTags = hasStudentSignal ? topSharedTags(studentVector, mentorVector) : [];

      const finalScore = hasStudentSignal
        ? Math.round(
            (0.5 * topicFit)
            + (0.25 * activityStats.recentActivityScore)
            + (0.15 * activityStats.helpfulnessScore)
            + (0.10 * availabilityScore),
          )
        : Math.round(
            (0.6 * activityStats.recentActivityScore)
            + (0.25 * activityStats.helpfulnessScore)
            + (0.15 * availabilityScore),
          );

      scored.push({
        mentor: profile,
        score: finalScore,
        reasons: {
          topicFit,
          recentActivity: activityStats.recentActivityScore,
          helpfulness: activityStats.helpfulnessScore,
          availability: availabilityScore,
          topSharedTags: sharedTags,
          summary: buildReasonSummary({
            hasStudentSignal,
            sharedTags,
            recentActivityScore: activityStats.recentActivityScore,
            helpfulnessScore: activityStats.helpfulnessScore,
            availability: profile.availability,
          }),
        },
        stats: {
          lastActivityAt: activityStats.lastActivityAt,
          recentActiveDays: activityStats.recentActiveDays,
        },
        confidence: getConfidence(finalScore),
        lastActivityAt: activityStats.lastActivityAt,
      });
    }

    scored.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.reasons.topicFit !== left.reasons.topicFit) return right.reasons.topicFit - left.reasons.topicFit;
      const rightActivity = right.lastActivityAt ? new Date(right.lastActivityAt).getTime() : 0;
      const leftActivity = left.lastActivityAt ? new Date(left.lastActivityAt).getTime() : 0;
      if (rightActivity !== leftActivity) return rightActivity - leftActivity;
      return String(left.mentor.userId?._id || left.mentor.userId).localeCompare(
        String(right.mentor.userId?._id || right.mentor.userId),
      );
    });

    const payload = {
      modelVersion: MATCH_MODEL_VERSION,
      generatedAt: new Date().toISOString(),
      studentSignal: {
        hasTopicSignal: hasStudentSignal,
        topTags: studentTopTags,
      },
      suggestions: scored.slice(0, normalizedLimit).map((entry) => ({
        mentor: {
          id: String(entry.mentor.userId?._id || entry.mentor.userId),
          name: entry.mentor.userId?.name || "Unknown Mentor",
          role: entry.mentor.roleType,
          bio: entry.mentor.bio || null,
          availability: entry.mentor.availability,
        },
        score: entry.score,
        confidence: entry.confidence,
        stats: entry.stats,
        reasons: entry.reasons,
      })),
    };

    this.setCachedSuggestions(userId, normalizedLimit, payload);
    return payload;
  }

  async warmSuggestionsCache() {
    const activeStudentIds = await ActivityEvent.distinct("userId", {
      occurredAt: { $gte: new Date(Date.now() - 7 * DAY_MS) },
      roleSnapshot: "Student",
    });

    for (const userId of activeStudentIds) {
      try {
        await this.getSuggestionsForUser(userId, 3, { skipCache: true });
      } catch (error) {
        logger.warn("Mentor suggestion cache warm failed for user", { userId: String(userId), message: error.message });
      }
    }

    return { warmedUsers: activeStudentIds.length };
  }
}

module.exports = new MentorshipService();
