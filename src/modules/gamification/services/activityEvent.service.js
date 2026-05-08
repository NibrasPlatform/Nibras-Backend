const User = require("../../users/models/user.model");
const ActivityEvent = require("../models/activityEvent.model");
const {
  COMMUNITY_EVENT_POINTS,
  CONTEST_EVENT_POINTS,
  getContestRatingGainPoints,
  getProblemSolvedPoints,
} = require("../utils/scoring.util");

class ActivityEventService {
  async resolveRoleSnapshot(userId, explicitRole = null) {
    if (explicitRole) {
      return explicitRole;
    }

    const user = await User.findById(userId).populate("role");
    return user?.role?.name || "Student";
  }

  async createEvent(payload) {
    if (!payload?.userId || !payload?.eventType || !payload?.dedupeKey) {
      return null;
    }

    const roleSnapshot = await this.resolveRoleSnapshot(payload.userId, payload.roleSnapshot);

    try {
      return await ActivityEvent.create({
        userId: payload.userId,
        roleSnapshot,
        source: payload.source,
        eventType: payload.eventType,
        points: Number(payload.points || 0),
        occurredAt: payload.occurredAt || new Date(),
        scope: {
          global: true,
          courseId: payload.scope?.courseId || null,
        },
        refs: payload.refs || {},
        metadata: payload.metadata || {},
        dedupeKey: payload.dedupeKey,
      });
    } catch (error) {
      if (error?.code === 11000) {
        return null;
      }
      throw error;
    }
  }

  async recordProblemSolved({ userId, problem, occurredAt, roleSnapshot }) {
    if (!userId || !problem?._id) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "problems",
      eventType: "problem_solved",
      points: getProblemSolvedPoints(problem.difficulty),
      occurredAt: occurredAt || new Date(),
      refs: {
        problemId: problem._id,
      },
      metadata: {
        difficulty: problem.difficulty || null,
      },
      dedupeKey: `problem_solved:${userId}:${problem._id}`,
    });
  }

  async recordContestJoined({ userId, contestId, occurredAt, roleSnapshot }) {
    if (!userId || !contestId) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "contests",
      eventType: "contest_joined",
      points: CONTEST_EVENT_POINTS.contest_joined,
      occurredAt: occurredAt || new Date(),
      refs: { contestId },
      dedupeKey: `contest_joined:${userId}:${contestId}`,
    });
  }

  async recordContestPlacement({ userId, contestId, bucket, occurredAt, roleSnapshot }) {
    if (!userId || !contestId || !bucket) return null;

    const eventType = bucket === "top_10" ? "contest_top_10" : "contest_top_25";
    return this.createEvent({
      userId,
      roleSnapshot,
      source: "contests",
      eventType,
      points: CONTEST_EVENT_POINTS[eventType],
      occurredAt: occurredAt || new Date(),
      refs: { contestId },
      metadata: {
        percentileBucket: bucket,
      },
      dedupeKey: `${eventType}:${userId}:${contestId}`,
    });
  }

  async recordContestRatingGain({ userId, contestId, ratingChange, occurredAt, roleSnapshot }) {
    const points = getContestRatingGainPoints(ratingChange);
    if (!userId || !contestId || points <= 0) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "contests",
      eventType: "contest_rating_gain",
      points,
      occurredAt: occurredAt || new Date(),
      refs: { contestId },
      metadata: {
        ratingChange: Number(ratingChange || 0),
      },
      dedupeKey: `contest_rating_gain:${userId}:${contestId}`,
    });
  }

  async recordQuestionCreated({ userId, questionId, courseId, occurredAt, roleSnapshot }) {
    return this.createEvent({
      userId,
      roleSnapshot,
      source: "community",
      eventType: "question_created",
      points: COMMUNITY_EVENT_POINTS.question_created,
      occurredAt: occurredAt || new Date(),
      scope: { courseId: courseId || null },
      refs: { questionId },
      dedupeKey: `question_created:${questionId}`,
    });
  }

  async recordAnswerCreated({ userId, answerId, questionId, courseId, occurredAt, roleSnapshot }) {
    return this.createEvent({
      userId,
      roleSnapshot,
      source: "community",
      eventType: "answer_created",
      points: COMMUNITY_EVENT_POINTS.answer_created,
      occurredAt: occurredAt || new Date(),
      scope: { courseId: courseId || null },
      refs: { answerId, questionId },
      dedupeKey: `answer_created:${answerId}`,
    });
  }

  async recordAcceptedAnswer({ userId, answerId, questionId, courseId, occurredAt, roleSnapshot }) {
    return this.createEvent({
      userId,
      roleSnapshot,
      source: "community",
      eventType: "accepted_answer",
      points: COMMUNITY_EVENT_POINTS.accepted_answer,
      occurredAt: occurredAt || new Date(),
      scope: { courseId: courseId || null },
      refs: { answerId, questionId },
      dedupeKey: `accepted_answer:${answerId}`,
    });
  }

  async recordThreadCreated({ userId, threadId, courseId, occurredAt, roleSnapshot }) {
    return this.createEvent({
      userId,
      roleSnapshot,
      source: "community",
      eventType: "thread_created",
      points: COMMUNITY_EVENT_POINTS.thread_created,
      occurredAt: occurredAt || new Date(),
      scope: { courseId: courseId || null },
      refs: { threadId },
      dedupeKey: `thread_created:${threadId}`,
    });
  }

  async recordVoteReward({
    userId,
    voteId,
    voterId,
    targetType,
    targetId,
    questionId,
    answerId,
    threadId,
    courseId,
    occurredAt,
    roleSnapshot,
  }) {
    if (!userId || !voterId || !targetType || !targetId) return null;

    const eventType = targetType === "answer" ? "answer_upvote_received" : "question_upvote_received";
    const points = eventType === "answer_upvote_received" ? 3 : 2;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "community",
      eventType,
      points,
      occurredAt: occurredAt || new Date(),
      scope: { courseId: courseId || null },
      refs: {
        voteId: voteId || null,
        questionId: questionId || null,
        answerId: answerId || null,
        threadId: threadId || null,
      },
      dedupeKey: `${eventType}:${targetType}:${targetId}:${voterId}`,
    });
  }

  async recordBadgeAwarded({ userId, achievementId, occurredAt, roleSnapshot }) {
    if (!userId || !achievementId) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "gamification",
      eventType: "badge_awarded",
      points: COMMUNITY_EVENT_POINTS.badge_awarded,
      occurredAt: occurredAt || new Date(),
      refs: { achievementId },
      dedupeKey: `badge_awarded:${userId}:${achievementId}`,
    });
  }
}

module.exports = new ActivityEventService();
