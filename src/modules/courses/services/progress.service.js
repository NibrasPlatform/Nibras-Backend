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
  })
    .select("metadata.dayKey occurredAt")
    .lean();

  const dayKeys = new Set(
    dailyEvents
      .map((event) => event?.metadata?.dayKey || resolveDayKey(event?.occurredAt))
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

const getProgress = async (userId, courseId) => {
  let progress = await Progress.findOne({ userId, courseId });

  // نجيب كل السكاشن الحالية للكورس
  const currentSections = await Section.find({ courseId }).sort({ order: 1 });

  if (!progress) {
    // لو مفيش بروجرس خالص، نكريته بالسكاشن الحالية
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
      percentage: 0,
      status: "not_started"
    });
  } else {
    // الحتة دي هي اللي ناقصاك: لو البروجرس موجود، نتأكد إن كل السكاشن مضافة فيه
    let updated = false;
    currentSections.forEach((section, idx) => {
      const exists = progress.items.find(item => item.itemId.toString() === section._id.toString());
      if (!exists) {
        // لو سكشن جديد ضيفه كـ locked
        progress.items.push({
          itemId: section._id,
          itemModel: "Section",
          itemType: "section",
          order: section.order || idx + 1,
          mandatory: true,
          status: "locked" 
        });
        updated = true;
      }
    });
    
    // لو ضفنا حاجة جديدة، نسيف التعديل
    // ... بعد ما تخلص الـ loop بتاع الـ forEach وتضيف السكاشن الجديدة
if (updated) {
  // إعادة حساب النسبة المئوية بناءً على العدد الفعلي الجديد
  const totalSections = currentSections.length;
  const completedCount = progress.completedSections.length;
  
  progress.percentage = totalSections > 0 
    ? Math.round((completedCount / totalSections) * 100) 
    : 0;

  await progress.save();
}
  }

  return await progress.populate([
    { path: "userId", select: "name email" },
    { path: "courseId", select: "title level" },
    { path: "completedSections" }
  ]);
};

const updateSectionStatus = async (userId, courseId, sectionId, isCompleted, options = {}) => {
  const course = await Course.findById(courseId);
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  const section = await Section.findById(sectionId);
  if (!section) {
    const error = new Error("Section not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  if (section.courseId.toString() !== courseId) {
    const error = new Error("Section does not belong to this course");
    error.statusCode = httpStatus.BAD_REQUEST;
    throw error;
  }

  let progress = await Progress.findOne({ userId, courseId });

  if (!progress) {
    progress = await Progress.create({
      userId,
      courseId,
      completedSections: isCompleted ? [sectionId] : [],
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

  // If marking completed, ensure previous section completed (sequential unlocking)
  const currentItemIndex = progress.items.findIndex((it) => it.itemId.toString() === sectionIdStr && it.itemType === "section");
  if (currentItemIndex === -1) {
    // if item not present, add it as available or completed
    progress.items.push({ itemId: section._id, itemModel: "Section", itemType: "section", order: section.order || 0, mandatory: true, status: isCompleted ? "completed" : "available" });
  }

  const currIdx = progress.items.findIndex((it) => it.itemId.toString() === sectionIdStr && it.itemType === "section");
  const prevItem = currIdx > 0 ? progress.items[currIdx - 1] : null;

  if (isCompleted) {
    // If section has lessons, require client indicate watchedAll (best-effort enforcement)
    lessonsInSection = await Lesson.find({ sectionId }).select("_id").lean();
    if (lessonsInSection.length > 0) {
      if (!options.watchedAll) {
        const error = new Error("All mandatory content for this section must be watched before marking completed.");
        error.statusCode = httpStatus.BAD_REQUEST;
        throw error;
      }
    }
    // if previous exists and is not completed, block
    if (prevItem && prevItem.status !== "completed") {
      const error = new Error("Previous section must be completed before unlocking this section");
      error.statusCode = httpStatus.BAD_REQUEST;
      throw error;
    }

    if (!isAlreadyCompleted) {
      progress.completedSections.push(sectionId);
    }

    // mark current item completed
    if (currIdx !== -1) progress.items[currIdx].status = "completed";

    // unlock next item if exists
    const nextIdx = currIdx + 1;
    if (nextIdx < progress.items.length && progress.items[nextIdx].status === "locked") {
      progress.items[nextIdx].status = "available";
    }
  } else {
    // unmark completion: remove and lock subsequent items
    if (isAlreadyCompleted) {
      progress.completedSections = progress.completedSections.filter((id) => id.toString() !== sectionIdStr);
    }

    if (currIdx !== -1) progress.items[currIdx].status = "available";

    // lock all subsequent items and remove them from completedSections
    for (let i = currIdx + 1; i < progress.items.length; i++) {
      if (progress.items[i].status === "completed") {
        // remove from completedSections
        const removeId = progress.items[i].itemId.toString();
        progress.completedSections = progress.completedSections.filter((id) => id.toString() !== removeId);
      }
      progress.items[i].status = "locked";
    }
  }

  const totalSections = await Section.countDocuments({ courseId });

  if (totalSections > 0) {
    progress.percentage = Math.round((progress.completedSections.length / totalSections) * 100);
  } else {
    progress.percentage = 0;
  }

  if (progress.percentage === 100) {
    progress.status = "completed";
  } else if (progress.percentage > 0) {
    progress.status = "in_progress";
  } else {
    progress.status = "not_started";
  }

  await progress.save();

  await progress.populate("userId", "name email");
  await progress.populate("courseId", "title level");
  await progress.populate("completedSections");

  const occurredAt = new Date();
  if (isCompleted && !isAlreadyCompleted) {
    await activityEventService.recordSectionCompleted({
      userId,
      courseId,
      sectionId,
      occurredAt,
    });

    if (lessonsInSection.length > 0) {
      await Promise.all(
        lessonsInSection.map((lesson) =>
          activityEventService.recordLessonCompleted({
            userId,
            courseId,
            sectionId,
            lessonId: lesson._id,
            occurredAt,
          })
        )
      );
    }
  }

  if (Number(progress.percentage || 0) !== previousPercentage) {
    await activityEventService.recordCourseProgressBonus({
      userId,
      courseId,
      previousProgress: previousPercentage,
      newProgress: Number(progress.percentage || 0),
      occurredAt,
    });
  }

  if (previousStatus !== "completed" && progress.status === "completed") {
    await activityEventService.recordCourseCompleted({
      userId,
      courseId,
      occurredAt,
    });
  }

  await trackDailyLearningConsistency({
    userId,
    courseId,
    occurredAt,
  });

  return progress;
};

/**
 * Calculate weighted grade and persist it on the progress record.
 * scores: { projects, assignments, quizzes, participation } each 0-100
 */
const calculateWeightedGrade = async (userId, courseId, scores = {}) => {
  const weights = {
    projects: 0.3,
    assignments: 0.3,
    quizzes: 0.2,
    participation: 0.1,
  };

  const p = await Progress.findOne({ userId, courseId });
  if (!p) {
    const error = new Error("Progress not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  const proj = Number(scores.projects || 0);
  const asg = Number(scores.assignments || 0);
  const quiz = Number(scores.quizzes || 0);
  const part = Number(scores.participation || 0);

  const weighted = Math.min(
    100,
    Math.round((proj * weights.projects + asg * weights.assignments + quiz * weights.quizzes + part * weights.participation) * 100) / 100
  );

  p.weightedGrade = weighted;
  await p.save();
  return p.weightedGrade;
};

/**
 * Aggregate user's progress across all courses and return average percentage.
 */
const getGlobalProgress = async (userId) => {
  const progresses = await Progress.find({ userId });
  if (!progresses || progresses.length === 0) {
    return { overallPercentage: 0, courses: 0 };
  }

  const total = progresses.reduce((acc, cur) => acc + (cur.percentage || 0), 0);
  const overallPercentage = Math.round((total / progresses.length) * 100) / 100;

  return {
    overallPercentage,
    courses: progresses.length,
    details: progresses.map((p) => ({ courseId: p.courseId, percentage: p.percentage, status: p.status })),
  };
};

const applyAssignmentApprovalBoost = async (userId, courseId, options = {}) => {
  const course = await Course.findById(courseId).select("assignments");
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  const totalAssignments = Array.isArray(course.assignments) ? course.assignments.length : 0;
  if (totalAssignments === 0) {
    return null;
  }

  const approvedCount = await Submission.countDocuments({
    userId,
    courseId,
    status: "approved",
  });

  const progress = await getProgress(userId, courseId);
  const previousPercentage = Number(progress.percentage || 0);
  const previousStatus = progress.status;
  const assignmentBoostTarget = Math.round((Math.min(approvedCount, totalAssignments) / totalAssignments) * 30);

  progress.percentage = Math.max(progress.percentage || 0, assignmentBoostTarget);
  if (progress.percentage >= 100) {
    progress.status = "completed";
  } else if (progress.percentage > 0) {
    progress.status = "in_progress";
  } else {
    progress.status = "not_started";
  }

  await progress.save();

  const occurredAt = options.occurredAt || new Date();
  if (Number(progress.percentage || 0) !== previousPercentage) {
    await activityEventService.recordCourseProgressBonus({
      userId,
      courseId,
      previousProgress: previousPercentage,
      newProgress: Number(progress.percentage || 0),
      occurredAt,
    });
  }

  if (previousStatus !== "completed" && progress.status === "completed") {
    await activityEventService.recordCourseCompleted({
      userId,
      courseId,
      occurredAt,
    });
  }

  await trackDailyLearningConsistency({
    userId,
    courseId,
    occurredAt,
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
