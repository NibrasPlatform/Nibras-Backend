const User = require("../../users/models/user.model");
const ActivityEvent = require("../models/activityEvent.model");
const {
  COMMUNITY_EVENT_POINTS,
  CONTEST_EVENT_POINTS,
  COURSE_EVENT_POINTS,
  getContestRatingGainPoints,
  getCourseProgressBonusPoints,
  getHighGradeBonusPoints,
  getProblemSolvedPoints,
} = require("../utils/scoring.util");

const COURSE_EVENT_TYPE_ALIAS = Object.freeze({
  LESSON_COMPLETED: "lesson_completed",
  SECTION_COMPLETED: "section_completed",
  COURSE_COMPLETED: "course_completed",
  ASSIGNMENT_SUBMITTED: "assignment_submitted",
  ASSIGNMENT_APPROVED: "assignment_approved",
  HIGH_GRADE: "high_grade",
  DAILY_LEARNING_ACTIVITY: "daily_learning_activity",
  LEARNING_STREAK: "learning_streak",
  COURSE_PROGRESS_BONUS: "course_progress_bonus",
});
const STREAK_MILESTONES = new Set([7, 14, 30, 60]);

const toDayKey = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

class ActivityEventService {
  normalizeCourseEventType(type) {
    const normalized = String(type || "").trim();
    if (!normalized) return null;
    return COURSE_EVENT_TYPE_ALIAS[normalized] || COURSE_EVENT_TYPE_ALIAS[normalized.toUpperCase()] || normalized;
  }

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
      const createdEvent = await ActivityEvent.create({
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

      if (!payload.skipReputationSync) {
        const gamificationService = require("./gamification.service");
        await gamificationService.syncUserReputationScore(payload.userId);
      }
      return createdEvent;
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

  async recordLessonCompleted({ userId, courseId, sectionId, lessonId, occurredAt, roleSnapshot, skipReputationSync = false }) {
    if (!userId || !courseId || !sectionId || !lessonId) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "courses",
      eventType: "lesson_completed",
      points: COURSE_EVENT_POINTS.lesson_completed,
      occurredAt: occurredAt || new Date(),
      scope: { courseId },
      refs: { courseId, sectionId, lessonId },
      dedupeKey: `lesson_completed:${userId}:${lessonId}`,
      skipReputationSync,
    });
  }

  async recordSectionCompleted({ userId, courseId, sectionId, occurredAt, roleSnapshot, skipReputationSync = false }) {
    if (!userId || !courseId || !sectionId) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "courses",
      eventType: "section_completed",
      points: COURSE_EVENT_POINTS.section_completed,
      occurredAt: occurredAt || new Date(),
      scope: { courseId },
      refs: { courseId, sectionId },
      dedupeKey: `section_completed:${userId}:${sectionId}`,
      skipReputationSync,
    });
  }

  async recordCourseCompleted({ userId, courseId, occurredAt, roleSnapshot, skipReputationSync = false }) {
    if (!userId || !courseId) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "courses",
      eventType: "course_completed",
      points: COURSE_EVENT_POINTS.course_completed,
      occurredAt: occurredAt || new Date(),
      scope: { courseId },
      refs: { courseId },
      dedupeKey: `course_completed:${userId}:${courseId}`,
      skipReputationSync,
    });
  }

  async recordAssignmentSubmitted({
    userId,
    courseId,
    assignmentId,
    submissionId,
    occurredAt,
    roleSnapshot,
    skipReputationSync = false,
  }) {
    if (!userId || !courseId || !submissionId) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "courses",
      eventType: "assignment_submitted",
      points: COURSE_EVENT_POINTS.assignment_submitted,
      occurredAt: occurredAt || new Date(),
      scope: { courseId },
      refs: {
        courseId,
        assignmentId: assignmentId || null,
        submissionId: submissionId || null,
      },
      dedupeKey: `assignment_submitted:${userId}:${submissionId}`,
      skipReputationSync,
    });
  }

  async recordAssignmentApproved({
    userId,
    courseId,
    assignmentId,
    submissionId,
    occurredAt,
    roleSnapshot,
    skipReputationSync = false,
  }) {
    if (!userId || !courseId || !submissionId) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "courses",
      eventType: "assignment_approved",
      points: COURSE_EVENT_POINTS.assignment_approved,
      occurredAt: occurredAt || new Date(),
      scope: { courseId },
      refs: {
        courseId,
        assignmentId: assignmentId || null,
        submissionId: submissionId || null,
      },
      dedupeKey: `assignment_approved:${userId}:${submissionId}`,
      skipReputationSync,
    });
  }

  async recordHighGrade({
    userId,
    courseId,
    assignmentId,
    submissionId,
    grade,
    occurredAt,
    roleSnapshot,
    skipReputationSync = false,
  }) {
    const points = getHighGradeBonusPoints(grade);
    if (!userId || !courseId || !submissionId || points <= 0) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "courses",
      eventType: "high_grade",
      points,
      occurredAt: occurredAt || new Date(),
      scope: { courseId },
      refs: {
        courseId,
        assignmentId: assignmentId || null,
        submissionId: submissionId || null,
      },
      metadata: {
        grade: Number(grade || 0),
      },
      dedupeKey: `high_grade:${userId}:${submissionId}`,
      skipReputationSync,
    });
  }

  async recordDailyLearningActivity({ userId, courseId, dayKey, occurredAt, roleSnapshot, skipReputationSync = false }) {
    if (!userId || !courseId) return null;
    const resolvedDayKey = dayKey || toDayKey(occurredAt || new Date());
    if (!resolvedDayKey) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "courses",
      eventType: "daily_learning_activity",
      points: COURSE_EVENT_POINTS.daily_learning_activity,
      occurredAt: occurredAt || new Date(),
      scope: { courseId },
      refs: { courseId },
      metadata: { dayKey: resolvedDayKey },
      dedupeKey: `daily_learning:${userId}:${resolvedDayKey}`,
      skipReputationSync,
    });
  }

  async recordLearningStreak({
    userId,
    courseId,
    streakDays,
    dayKey,
    occurredAt,
    roleSnapshot,
    skipReputationSync = false,
  }) {
    if (!userId || !courseId) return null;
    const normalizedStreak = Number(streakDays || 0);
    if (!STREAK_MILESTONES.has(normalizedStreak)) return null;
    const resolvedDayKey = dayKey || toDayKey(occurredAt || new Date());
    if (!resolvedDayKey) return null;

    return this.createEvent({
      userId,
      roleSnapshot,
      source: "courses",
      eventType: "learning_streak",
      points: COURSE_EVENT_POINTS.learning_streak,
      occurredAt: occurredAt || new Date(),
      scope: { courseId },
      refs: { courseId },
      metadata: {
        streakDays: normalizedStreak,
        dayKey: resolvedDayKey,
      },
      dedupeKey: `learning_streak:${userId}:${normalizedStreak}`,
      skipReputationSync,
    });
  }

  async recordCourseProgressBonus({
    userId,
    courseId,
    previousProgress,
    newProgress,
    occurredAt,
    roleSnapshot,
    skipReputationSync = false,
  }) {
    const normalizedPrevious = Math.round(Number(previousProgress || 0) * 100) / 100;
    const normalizedNew = Math.round(Number(newProgress || 0) * 100) / 100;
    const progressDelta = Math.max(normalizedNew - normalizedPrevious, 0);
    const points = getCourseProgressBonusPoints(normalizedNew, normalizedPrevious);
    if (!userId || !courseId || points <= 0) return null;
    return this.createEvent({
      userId,
      roleSnapshot,
      source: "courses",
      eventType: "course_progress_bonus",
      points,
      occurredAt: occurredAt || new Date(),
      scope: { courseId },
      refs: { courseId },
      metadata: {
        previousProgress: normalizedPrevious,
        progressPercentage: normalizedNew,
        progressDelta,
      },
      dedupeKey: `course_progress_bonus:${userId}:${courseId}:${normalizedPrevious}:${normalizedNew}`,
      skipReputationSync,
    });
  }

  async record(payload) {
    const eventType = this.normalizeCourseEventType(payload?.type || payload?.eventType);
    if (!payload?.userId || !eventType) return null;

    const metadata = payload?.metadata || {};
    const common = {
      userId: payload.userId,
      courseId: metadata.courseId || payload.courseId || null,
      occurredAt: payload.occurredAt || new Date(),
      roleSnapshot: payload.roleSnapshot || null,
      skipReputationSync: Boolean(payload.skipReputationSync),
    };

    switch (eventType) {
      case "lesson_completed":
        return this.recordLessonCompleted({
          ...common,
          sectionId: metadata.sectionId,
          lessonId: metadata.lessonId,
        });
      case "section_completed":
        return this.recordSectionCompleted({
          ...common,
          sectionId: metadata.sectionId,
        });
      case "course_completed":
        return this.recordCourseCompleted(common);
      case "assignment_submitted":
        return this.recordAssignmentSubmitted({
          ...common,
          assignmentId: metadata.assignmentId,
          submissionId: metadata.submissionId || null,
        });
      case "assignment_approved":
        return this.recordAssignmentApproved({
          ...common,
          assignmentId: metadata.assignmentId,
          submissionId: metadata.submissionId || null,
        });
      case "high_grade":
        return this.recordHighGrade({
          ...common,
          assignmentId: metadata.assignmentId,
          submissionId: metadata.submissionId || null,
          grade: metadata.grade,
        });
      case "daily_learning_activity":
        return this.recordDailyLearningActivity({
          ...common,
          dayKey: metadata.dayKey || null,
        });
      case "learning_streak":
        return this.recordLearningStreak({
          ...common,
          streakDays: metadata.streakDays,
          dayKey: metadata.dayKey || null,
        });
      case "course_progress_bonus":
        return this.recordCourseProgressBonus({
          ...common,
          previousProgress: metadata.previousProgress,
          newProgress: metadata.newProgress || metadata.progressPercentage,
        });
      default:
        return this.createEvent({
          ...payload,
          eventType,
        });
    }
  }
}

module.exports = new ActivityEventService();
