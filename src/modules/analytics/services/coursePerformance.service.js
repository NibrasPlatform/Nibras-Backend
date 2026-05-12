const mongoose = require("mongoose");
const Progress = require("../../courses/models/progress.model");
const Section = require("../../courses/models/section.model");
const Submission = require("../../courses/models/submission.model");
const Course = require("../../courses/models/course.model");
const User = require("../../users/models/user.model");

/**
 * Build a comprehensive course performance dashboard for an instructor.
 *
 * Strategy:
 *  1. Fetch ALL Progress records for the course first — this single indexed
 *     query feeds enrollment stats, grade distribution, and the leaderboard,
 *     avoiding three separate DB round-trips.
 *  2. Fire the remaining independent queries in parallel.
 *  3. Compute every derived metric in pure JS.
 *
 * @param {string} courseId - MongoDB ObjectId string of the target course
 * @param {number} topN     - Number of students to include in the leaderboard (1–50)
 * @returns {Promise<Object>} assembled course performance data
 */
const getCoursePerformance = async (courseId, topN = 10) => {
  const courseObjId = new mongoose.Types.ObjectId(courseId);

  // ── Phase 1: fetch all progress records (reused in 4 of 5 sections) ───────
  const progresses = await Progress.find({ courseId: courseObjId })
    .select("userId status weightedGrade percentage completedSections")
    .lean();

  const totalEnrolled = progresses.length;

  // Pre-compute the leaderboard sort so we can batch-fetch only the top-N
  // user names in Phase 2 (avoid pulling all user names unnecessarily).
  const sortedByGrade = [...progresses].sort(
    (a, b) => b.weightedGrade - a.weightedGrade
  );
  const topSlice = sortedByGrade.slice(0, topN);
  const topIds = topSlice.map((p) => p.userId);

  // ── Phase 2: fire remaining queries in parallel ───────────────────────────
  const [sections, submissionStats, course, topStudentUsers] =
    await Promise.all([
      // 2a. All sections for the course, sorted by their display order
      Section.find({ courseId: courseObjId }).sort({ order: 1 }).lean(),

      // 2b. Submission stats per assignment — two-stage grouping:
      //     first group by (assignmentId, status) to count & sum grades,
      //     then group by assignmentId to collapse into a single doc per assignment.
      Submission.aggregate([
        { $match: { courseId: courseObjId } },
        {
          $group: {
            _id: { assignmentId: "$assignmentId", status: "$status" },
            count: { $sum: 1 },
            totalGradeSum: { $sum: { $ifNull: ["$grade", 0] } },
            gradedCount: {
              $sum: { $cond: [{ $ne: ["$grade", null] }, 1, 0] },
            },
          },
        },
        {
          $group: {
            _id: "$_id.assignmentId",
            totalSubmissions: { $sum: "$count" },
            statusBreakdown: {
              $push: { status: "$_id.status", count: "$count" },
            },
            totalGradeSum: { $sum: "$totalGradeSum" },
            gradedCount: { $sum: "$gradedCount" },
          },
        },
      ]),

      // 2c. Course document — needed for the assignments[] array (titles)
      Course.findById(courseObjId)
        .select("assignments title courseCode")
        .lean(),

      // 2d. User names for the leaderboard (only top-N users)
      User.find({ _id: { $in: topIds } }).select("name").lean(),
    ]);

  // ── Phase 3: compute derived metrics in pure JS ───────────────────────────

  // 3a. Enrollment stats
  const completedCount = progresses.filter(
    (p) => p.status === "completed"
  ).length;
  const inProgressCount = progresses.filter(
    (p) => p.status === "in_progress"
  ).length;
  const notStartedCount = progresses.filter(
    (p) => p.status === "not_started"
  ).length;
  const completionRate =
    totalEnrolled > 0
      ? Math.round((completedCount / totalEnrolled) * 100)
      : 0;

  const enrollmentStats = {
    totalEnrolled,
    completedCount,
    inProgressCount,
    notStartedCount,
    completionRate,
  };

  // 3b. Grade distribution — exclude zero-grade records (not yet graded)
  const grades = progresses
    .map((p) => p.weightedGrade)
    .filter((g) => g > 0);

  const averageGrade =
    grades.length > 0
      ? Math.round(
          (grades.reduce((sum, g) => sum + g, 0) / grades.length) * 100
        ) / 100
      : 0;

  const minGrade = grades.length > 0 ? Math.min(...grades) : 0;
  const maxGrade = grades.length > 0 ? Math.max(...grades) : 0;

  const buckets = { A: 0, B: 0, C: 0, F: 0 };
  grades.forEach((g) => {
    if (g >= 90) buckets.A += 1;
    else if (g >= 75) buckets.B += 1;
    else if (g >= 60) buckets.C += 1;
    else buckets.F += 1;
  });

  const gradeDistribution = { averageGrade, minGrade, maxGrade, buckets };

  // 3c. Section analytics
  //     Build a Map<sectionId, completedCount> by iterating every student's
  //     completedSections array — no extra DB round-trip needed.
  const sectionCompletionMap = new Map();
  progresses.forEach((p) => {
    (p.completedSections || []).forEach((secId) => {
      const key = String(secId);
      sectionCompletionMap.set(key, (sectionCompletionMap.get(key) || 0) + 1);
    });
  });

  let prevRate = null;
  const sectionAnalytics = sections.map((sec) => {
    const completedBySection =
      sectionCompletionMap.get(String(sec._id)) || 0;
    const rate =
      totalEnrolled > 0
        ? Math.round((completedBySection / totalEnrolled) * 100)
        : 0;

    // A dropoff is detected when completion drops more than 20 percentage
    // points compared to the immediately preceding section.
    const dropoffDetected = prevRate !== null && prevRate - rate > 20;
    prevRate = rate;

    return {
      sectionId: sec._id,
      title: sec.title,
      order: sec.order,
      completedCount: completedBySection,
      totalStudents: totalEnrolled,
      completionRate: rate,
      dropoffDetected,
    };
  });

  // 3d. Assignment analytics
  //     Map submissionStats aggregation results by assignmentId for O(1) lookup.
  const subStatMap = new Map(
    submissionStats.map((s) => [String(s._id), s])
  );

  const assignmentAnalytics = (course?.assignments || []).map((a) => {
    const stat = subStatMap.get(String(a.assignmentId));
    const totalSubs = stat?.totalSubmissions || 0;

    const approvedEntry = stat?.statusBreakdown?.find(
      (sb) => sb.status === "approved"
    );
    const approvedCount = approvedEntry?.count || 0;

    const avgScore =
      stat && stat.gradedCount > 0
        ? Math.round((stat.totalGradeSum / stat.gradedCount) * 100) / 100
        : null;

    return {
      assignmentId: a.assignmentId,
      title: a.title,
      submissionCount: totalSubs,
      approvalRate:
        totalSubs > 0
          ? Math.round((approvedCount / totalSubs) * 100)
          : 0,
      averageScore: avgScore,
    };
  });

  // 3e. Student leaderboard
  const userMap = new Map(
    topStudentUsers.map((u) => [String(u._id), u.name])
  );

  const leaderboard = topSlice.map((p, i) => ({
    rank: i + 1,
    userId: p.userId,
    name: userMap.get(String(p.userId)) || "Unknown",
    progressPercentage: p.percentage,
    weightedGrade: p.weightedGrade,
    status: p.status,
  }));

  // ── Phase 4: assemble and return ─────────────────────────────────────────
  return {
    courseInfo: {
      courseId,
      title: course?.title ?? null,
      courseCode: course?.courseCode ?? null,
    },
    enrollmentStats,
    gradeDistribution,
    sectionAnalytics,
    assignmentAnalytics,
    leaderboard,
  };
};

module.exports = { getCoursePerformance };
