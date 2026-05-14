let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const Progress = require("../models/progress.model");
const Course = require("../models/course.model");
const Section = require("../models/section.model");
const Lesson = require("../models/lesson.model");
const Submission = require("../models/submission.model");
const ActivityEvent = require("../../gamification/models/activityEvent.model");
const activityEventService = require("../../gamification/services/activityEvent.service");

const STREAK_MILESTONES = new Set([7, 14, 30, 60]);

/**
 * Helpers
 */
const resolveDayKey = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getStreakDaysEndingAt = (dayKeys, targetDayKey) => {
  if (!targetDayKey || !dayKeys.has(targetDayKey)) return 0;

  const targetDate = new Date(`${targetDayKey}T00:00:00.000Z`);
  let streak = 0;

  while (true) {
    const current = new Date(targetDate);
    current.setUTCDate(targetDate.getUTCDate() - streak);

    const currentDayKey = current.toISOString().slice(0, 10);
    if (!dayKeys.has(currentDayKey)) break;

    streak += 1;
  }

  return streak;
};

const trackDailyLearningConsistency = async ({ userId, courseId, occurredAt = new Date() }) => {
  const dayKey = resolveDayKey(occurredAt);
  if (!dayKey) return;

  await activityEventService.recordDailyLearningActivity({
    userId,
    courseId,
    occurredAt,
    dayKey,
  });

  const dailyEvents = await ActivityEvent.find({
    userId,
    eventType: "daily_learning_activity",
  }).select("metadata.dayKey occurredAt").lean();

  const dayKeys = new Set(
    dailyEvents
      .map((e) => e?.metadata?.dayKey || resolveDayKey(e?.occurredAt))
      .filter(Boolean)
  );

  const streakDays = getStreakDaysEndingAt(dayKeys, dayKey);

  if (STREAK_MILESTONES.has(streakDays)) {
    await activityEventService.recordLearningStreak({
      userId,
      courseId,
      streakDays,
      dayKey,
      occurredAt,
    });
  }
};

/**
 * Get or create progress
 */
const getProgress = async (userId, courseId) => {
  let progress = await Progress.findOne({ userId, courseId });

  const currentSections = await Section.find({ courseId }).sort({ order: 1 });

  if (!progress) {
    const items = currentSections.map((s, idx) => ({
      itemId: s._id,
      itemModel: "Section",
      itemType: "section",
      order: s.order || idx + 1,
      mandatory: true,
      status: idx === 0 ? "available" : "locked",
    }));

    progress = await Progress.create({
      userId,
      courseId,
      items,
      completedSections: [],
      percentage: 0,
      status: "not_started",
    });
  } else {
    let updated = false;

    currentSections.forEach((section, idx) => {
      const exists = progress.items.find(
        (i) => i.itemId.toString() === section._id.toString()
      );

      if (!exists) {
        progress.items.push({
          itemId: section._id,
          itemModel: "Section",
          itemType: "section",
          order: section.order || idx + 1,
          mandatory: true,
          status: "locked",
        });

        updated = true;
      }
    });

    if (updated) {
      const totalSections = currentSections.length;
      const completedCount = progress.completedSections.length;

      progress.percentage =
        totalSections > 0
          ? Math.round((completedCount / totalSections) * 100)
          : 0;

      await progress.save();
    }
  }

  return progress.populate([
    { path: "userId", select: "name email" },
    { path: "courseId", select: "title level" },
    { path: "completedSections" },
  ]);
};

/**
 * Update section status
 */
const updateSectionStatus = async (userId, courseId, sectionId, isCompleted, options = {}) => {
  const course = await Course.findById(courseId);
  if (!course) throw new Error("Course not found");

  const section = await Section.findById(sectionId);
  if (!section) throw new Error("Section not found");

  if (section.courseId.toString() !== courseId) {
    throw new Error("Section does not belong to this course");
  }

  let progress = await Progress.findOne({ userId, courseId });

  if (!progress) {
    progress = await Progress.create({
      userId,
      courseId,
      completedSections: [],
      items: [],
      percentage: 0,
      status: "not_started",
    });
  }

  const sectionIdStr = sectionId.toString();

  const previousPercentage = Number(progress.percentage || 0);
  const previousStatus = progress.status;

  const isAlreadyCompleted = progress.completedSections.some(
    (id) => id.toString() === sectionIdStr
  );

  let lessonsInSection = [];

  const currIdx = progress.items.findIndex(
    (it) => it.itemId.toString() === sectionIdStr && it.itemType === "section"
  );

  if (currIdx === -1) {
    progress.items.push({
      itemId: section._id,
      itemModel: "Section",
      itemType: "section",
      order: section.order || 0,
      mandatory: true,
      status: isCompleted ? "completed" : "available",
    });
  }

  const currentIndex = progress.items.findIndex(
    (it) => it.itemId.toString() === sectionIdStr && it.itemType === "section"
  );

  const prevItem = currentIndex > 0 ? progress.items[currentIndex - 1] : null;

  if (isCompleted) {
    const lessons = await Lesson.find({ sectionId });

    if (lessons.length > 0 && !options.watchedAll) {
      throw new Error("All lessons must be completed first");
    }

    if (prevItem && prevItem.status !== "completed") {
      throw new Error("Previous section must be completed first");
    }

    lessonsInSection = lessons.map((l) => l._id);

    if (!isAlreadyCompleted) {
      progress.completedSections.push(sectionId);
    }

    if (currentIndex !== -1) {
      progress.items[currentIndex].status = "completed";
    }
  } else {
    progress.completedSections = progress.completedSections.filter(
      (id) => id.toString() !== sectionIdStr
    );

    if (currentIndex !== -1) {
      progress.items[currentIndex].status = "available";
    }
  }

  const totalSections = await Section.countDocuments({ courseId });

  progress.percentage =
    totalSections > 0
      ? Math.round((progress.completedSections.length / totalSections) * 100)
      : 0;

  progress.status =
    progress.percentage === 100
      ? "completed"
      : progress.percentage > 0
      ? "in_progress"
      : "not_started";

  await progress.save();

  if (isCompleted && !isAlreadyCompleted) {
    await activityEventService.recordSectionCompleted({
      userId,
      courseId,
      sectionId,
    });
  }

  if (previousPercentage !== progress.percentage) {
    await activityEventService.recordCourseProgressBonus({
      userId,
      courseId,
      previousProgress: previousPercentage,
      newProgress: progress.percentage,
    });
  }

  if (previousStatus !== "completed" && progress.status === "completed") {
    await activityEventService.recordCourseCompleted({
      userId,
      courseId,
    });
  }

  await trackDailyLearningConsistency({ userId, courseId });

  return progress;
};

/**
 * Weighted grade
 */
const calculateWeightedGrade = async (userId, courseId, scores = {}) => {
  const p = await Progress.findOne({ userId, courseId });
  if (!p) throw new Error("Progress not found");

  const weighted =
    (scores.projects || 0) * 0.3 +
    (scores.assignments || 0) * 0.3 +
    (scores.quizzes || 0) * 0.2 +
    (scores.participation || 0) * 0.1;

  p.weightedGrade = Math.min(100, Math.round(weighted * 100) / 100);

  await p.save();
  return p.weightedGrade;
};

/**
 * Global progress
 */
const getGlobalProgress = async (userId) => {
  const progresses = await Progress.find({ userId });

  if (!progresses.length) {
    return { overallPercentage: 0, courses: 0 };
  }

  const total = progresses.reduce((a, b) => a + (b.percentage || 0), 0);

  return {
    overallPercentage: Math.round(total / progresses.length),
    courses: progresses.length,
  };
};

/**
 * Assignment boost
 */
const applyAssignmentApprovalBoost = async (userId, courseId, options = {}) => {
  const course = await Course.findById(courseId).select("assignments");
  if (!course) throw new Error("Course not found");

  const totalAssignments = course.assignments?.length || 0;
  if (!totalAssignments) return null;

  const approvedCount = await Submission.countDocuments({
    userId,
    courseId,
    status: "approved",
  });

  const progress = await getProgress(userId, courseId);

  const previousPercentage = progress.percentage || 0;

  const boost = Math.round(
    (Math.min(approvedCount, totalAssignments) / totalAssignments) * 30
  );

  progress.percentage = Math.max(progress.percentage, boost);

  await progress.save();

  await trackDailyLearningConsistency({
    userId,
    courseId,
    occurredAt: options.occurredAt || new Date(),
  });

  return progress;
};

module.exports = {
  getProgress,
  updateSectionStatus,
  calculateWeightedGrade,
  getGlobalProgress,
  applyAssignmentApprovalBoost,
};
