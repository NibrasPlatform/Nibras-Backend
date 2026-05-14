const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const mongoose = require("mongoose");
const connectDatabase = require("../core/config/database");
const logger = require("../core/utils/logger");
const Role = require("../modules/auth/models/role.model");
const User = require("../modules/users/models/user.model");
const Lesson = require("../modules/courses/models/lesson.model");
const Progress = require("../modules/courses/models/progress.model");
const Submission = require("../modules/courses/models/submission.model");
const activityEventService = require("../modules/gamification/services/activityEvent.service");
const gamificationService = require("../modules/gamification/services/gamification.service");
const leaderboardService = require("../modules/gamification/services/leaderboard.service");
const STREAK_MILESTONES = new Set([7, 14, 30, 60]);

const toDayKey = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getRoleName = (userRoleMap, userId) => userRoleMap.get(String(userId)) || "Student";

const toObjectIdString = (value) => (value ? String(value) : null);
const normalizeRoleFallback = (rawRole) => {
  const value = String(rawRole || "").trim().toLowerCase();
  if (!value) return "Student";
  if (value === "ta") return "TA";
  return value
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const backfillProgressEvents = async (progressRows, lessonsBySection, userRoleMap, affectedUsers) => {
  for (const progress of progressRows) {
    const userId = progress.userId;
    const courseId = progress.courseId;
    const roleSnapshot = getRoleName(userRoleMap, userId);
    const occurredAt = progress.updatedAt || progress.createdAt || new Date();
    affectedUsers.add(String(userId));

    const completedSections = (progress.completedSections || []).map((sectionId) => String(sectionId));
    for (const sectionId of completedSections) {
      await activityEventService.recordSectionCompleted({
        userId,
        courseId,
        sectionId,
        occurredAt,
        roleSnapshot,
        skipReputationSync: true,
      });

      const lessons = lessonsBySection.get(sectionId) || [];
      for (const lessonId of lessons) {
        await activityEventService.recordLessonCompleted({
          userId,
          courseId,
          sectionId,
          lessonId,
          occurredAt,
          roleSnapshot,
          skipReputationSync: true,
        });
      }
    }

    if ((progress.percentage || 0) > 0) {
      await activityEventService.recordCourseProgressBonus({
        userId,
        courseId,
        previousProgress: 0,
        newProgress: Number(progress.percentage || 0),
        occurredAt,
        roleSnapshot,
        skipReputationSync: true,
      });
    }

    if (progress.status === "completed" || Number(progress.percentage || 0) >= 100) {
      await activityEventService.recordCourseCompleted({
        userId,
        courseId,
        occurredAt,
        roleSnapshot,
        skipReputationSync: true,
      });
    }

    const dayKey = toDayKey(occurredAt);
    if (dayKey) {
      await activityEventService.recordDailyLearningActivity({
        userId,
        courseId,
        dayKey,
        occurredAt,
        roleSnapshot,
        skipReputationSync: true,
      });
    }
  }
};

const backfillSubmissionEvents = async (submissions, userRoleMap, affectedUsers) => {
  const userDayMap = new Map();
  const courseByUser = new Map();

  for (const submission of submissions) {
    const userId = submission.userId;
    const courseId = submission.courseId;
    const assignmentId = submission.assignmentId;
    const submissionId = submission._id;
    const occurredAt = submission.updatedAt || submission.createdAt || new Date();
    const roleSnapshot = getRoleName(userRoleMap, userId);
    const dayKey = toDayKey(occurredAt);
    const userKey = toObjectIdString(userId);
    affectedUsers.add(userKey);
    if (!courseByUser.has(userKey)) {
      courseByUser.set(userKey, courseId);
    }

    await activityEventService.recordAssignmentSubmitted({
      userId,
      courseId,
      assignmentId,
      submissionId,
      occurredAt,
      roleSnapshot,
      skipReputationSync: true,
    });

    if (submission.status === "approved") {
      await activityEventService.recordAssignmentApproved({
        userId,
        courseId,
        assignmentId,
        submissionId,
        occurredAt,
        roleSnapshot,
        skipReputationSync: true,
      });
    }

    if (Number(submission.grade || 0) > 85) {
      await activityEventService.recordHighGrade({
        userId,
        courseId,
        assignmentId,
        submissionId,
        grade: submission.grade,
        occurredAt,
        roleSnapshot,
        skipReputationSync: true,
      });
    }

    if (dayKey) {
      await activityEventService.recordDailyLearningActivity({
        userId,
        courseId,
        dayKey,
        occurredAt,
        roleSnapshot,
        skipReputationSync: true,
      });

      if (!userDayMap.has(userKey)) userDayMap.set(userKey, new Set());
      userDayMap.get(userKey).add(dayKey);
    }
  }

  for (const [userId, daySet] of userDayMap.entries()) {
    const sortedDays = [...daySet].sort();
    let streak = 0;

    for (let i = 0; i < sortedDays.length; i += 1) {
      if (i === 0) {
        streak = 1;
      } else {
        const previous = new Date(`${sortedDays[i - 1]}T00:00:00.000Z`);
        const current = new Date(`${sortedDays[i]}T00:00:00.000Z`);
        const dayDiff = Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));
        streak = dayDiff === 1 ? streak + 1 : 1;
      }

      if (STREAK_MILESTONES.has(streak)) {
        await activityEventService.recordLearningStreak({
          userId,
          courseId: courseByUser.get(userId) || null,
          streakDays: streak,
          dayKey: sortedDays[i],
          occurredAt: new Date(`${sortedDays[i]}T12:00:00.000Z`),
          roleSnapshot: getRoleName(userRoleMap, userId),
          skipReputationSync: true,
        });
      }
    }
  }
};

const main = async () => {
  await connectDatabase();

  const users = await User.find().select("role").lean();
  const roleIds = [
    ...new Set(
      users
        .map((user) => user.role)
        .filter((role) => mongoose.Types.ObjectId.isValid(String(role)))
        .map((role) => String(role))
    ),
  ];
  const roles = await Role.find({ _id: { $in: roleIds } }).select("name").lean();
  const roleNameById = new Map(roles.map((role) => [String(role._id), role.name]));
  const userRoleMap = new Map(
    users.map((user) => {
      const roleKey = String(user.role || "");
      const roleName = roleNameById.get(roleKey) || normalizeRoleFallback(user.role);
      return [String(user._id), roleName];
    })
  );

  const [progressRows, submissions, lessons] = await Promise.all([
    Progress.find().select("userId courseId completedSections percentage status createdAt updatedAt").lean(),
    Submission.find().select("userId courseId assignmentId status grade createdAt updatedAt").lean(),
    Lesson.find().select("_id sectionId").lean(),
  ]);

  const lessonsBySection = lessons.reduce((accumulator, lesson) => {
    const sectionKey = String(lesson.sectionId);
    if (!accumulator.has(sectionKey)) accumulator.set(sectionKey, []);
    accumulator.get(sectionKey).push(String(lesson._id));
    return accumulator;
  }, new Map());

  const affectedUsers = new Set();
  await backfillProgressEvents(progressRows, lessonsBySection, userRoleMap, affectedUsers);
  await backfillSubmissionEvents(submissions, userRoleMap, affectedUsers);
  for (const userId of affectedUsers) {
    await gamificationService.syncUserReputationScore(userId);
  }
  await leaderboardService.rebuildCurrentLeaderboards(new Date());

  logger.info("Course activity events backfill completed");
  await mongoose.connection.close();
};

main().catch(async (error) => {
  logger.error("Course activity events backfill failed", { message: error.message });
  try {
    await mongoose.connection.close();
  } catch (_) {
    // ignore shutdown errors
  }
  process.exit(1);
});
