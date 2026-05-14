const mongoose = require("mongoose");
const User = require("../../users/models/user.model");
const Progress = require("../../courses/models/progress.model");
const Submission = require("../../courses/models/submission.model");
const Deadline = require("../models/deadline.model");
const Project = require("../models/project.model");
const Activity = require("../../gamification/models/activity.model");
const StudentAchievement = require("../../gamification/models/studentAchievement.model");
const UserProblemProgress = require("../../problems/models/userProblemProgress.model");
const Problem = require("../../problems/models/problem.model");

/**
 * Build a comprehensive student performance dashboard.
 * All DB queries are fired in parallel via Promise.all to minimise latency.
 *
 * TODO: Progress.weightedGrade stores only the final computed number.
 *       Component scores (assignments %, projects %, quizzes %, participation %)
 *       are not persisted on the model.  A future schema migration to add a
 *       `gradeComponents` sub-document on Progress is required before a
 *       per-component breakdown can be returned here.
 *
 * @param {string} studentId - MongoDB ObjectId string of the target student
 * @returns {Promise<Object>} assembled dashboard data
 */
const getStudentPerformanceDashboard = async (studentId) => {
  const studentObjId = new mongoose.Types.ObjectId(studentId);

  // ── Phase 1: validate the student exists ─────────────────────────────────
  const user = await User.findById(studentObjId).populate("role").lean();
  if (!user) {
    const err = new Error("Student not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Phase 2: fire all remaining queries in parallel ───────────────────────
  const [
    progresses,
    submissions,
    deadlines,
    studentAchievements,
    solvedProblems,
    problemTotals,
    recentActivities,
    activeProjects,
  ] = await Promise.all([
    // b. Course progress records (enrolled courses via Progress collection)
    Progress.find({ userId: studentObjId })
      .populate("courseId", "courseCode title level category instructorName")
      .lean(),

    // c. All submissions for this student
    Submission.find({ userId: studentObjId }).lean(),

    // d. Upcoming deadlines
    Deadline.find({ studentId: studentObjId }).lean(),

    // e. Earned achievements with full achievement details
    StudentAchievement.find({ studentId: studentObjId })
      .populate("achievementId")
      .lean(),

    // f. Solved problems (only solved: true records)
    UserProblemProgress.find({ userId: studentObjId, solved: true })
      .populate("problemId", "difficulty")
      .lean(),

    // g. Total problems available per difficulty level (aggregation)
    Problem.aggregate([
      { $group: { _id: "$difficulty", total: { $sum: 1 } } },
    ]),

    // h. Recent activities (latest 10)
    Activity.find({ studentId: studentObjId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),

    // i. Active projects
    Project.find({ studentId: studentObjId }).lean(),
  ]);

  // ── Phase 3: derive values in pure JS (no extra DB round-trips) ───────────

  // 3a. Courses grade summary — one entry per enrolled course
  const coursesGradeSummary = progresses.map((p) => ({
    courseId: p.courseId?._id ?? p.courseId,
    courseCode: p.courseId?.courseCode ?? null,
    title: p.courseId?.title ?? null,
    level: p.courseId?.level ?? null,
    category: p.courseId?.category ?? null,
    instructorName: p.courseId?.instructorName ?? null,
    percentage: p.percentage,
    weightedGrade: p.weightedGrade,
    status: p.status,
  }));

  // 3b. Submission summary — total count broken down by status
  const submissionSummary = submissions.reduce(
    (acc, s) => {
      acc.total += 1;
      if (s.status === "approved") acc.approved += 1;
      else if (s.status === "pending") acc.pending += 1;
      else if (s.status === "needs_changes") acc.needs_changes += 1;
      return acc;
    },
    { total: 0, approved: 0, pending: 0, needs_changes: 0 }
  );

  // 3c. Upcoming deadlines with days remaining
  const now = Date.now();
  const upcomingDeadlines = deadlines
    .map((d) => {
      const dueDateMs = new Date(d.dueDate).getTime();
      const daysRemaining = Math.ceil((dueDateMs - now) / 86_400_000);
      return {
        _id: d._id,
        title: d.title,
        type: d.type,
        dueDate: d.dueDate,
        daysRemaining,
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining); // nearest first

  // 3d. Problem progress per difficulty
  //     Build a map of total problems per difficulty from the aggregation result
  const totalPerDifficulty = problemTotals.reduce((acc, entry) => {
    acc[entry._id] = entry.total;
    return acc;
  }, {});

  //     Count solved problems per difficulty from the populated UserProblemProgress docs
  const solvedPerDifficulty = solvedProblems.reduce((acc, upp) => {
    const diff = upp.problemId?.difficulty;
    if (diff) {
      acc[diff] = (acc[diff] || 0) + 1;
    }
    return acc;
  }, {});

  const DIFFICULTY_LEVELS = ["beginner", "newbie", "intermediate", "advanced"];
  const problemProgress = DIFFICULTY_LEVELS.reduce((acc, level) => {
    const total = totalPerDifficulty[level] || 0;
    const solved = solvedPerDifficulty[level] || 0;
    acc[level] = {
      solved,
      total,
      percentage: total > 0 ? Math.round((solved / total) * 100) : 0,
    };
    return acc;
  }, {});

  // 3e. Badges — map StudentAchievement rows to a clean shape
  const badges = studentAchievements
    .filter((sa) => sa.achievementId) // guard against orphaned refs
    .map((sa) => ({
      achievementId: sa.achievementId._id,
      name: sa.achievementId.name,
      description: sa.achievementId.description,
      points: sa.achievementId.points,
      badgeIcon: sa.achievementId.badgeIcon,
      dateAwarded: sa.dateAwarded,
    }));

  // ── Phase 4: assemble the final response ──────────────────────────────────
  return {
    studentStats: {
      name: user.name,
      role: user.role?.name ?? null,
      reputation: user.reputationScore,
      contestRating: user.contestRating,
      problemsSolved: user.problemsSolved,
      studyStreak: user.studyStreak,
    },
    coursesGradeSummary,
    submissionSummary,
    upcomingDeadlines,
    problemProgress,
    badges,
    recentActivities: recentActivities.map((a) => ({
      _id: a._id,
      title: a.title,
      type: a.type,
      statusTag: a.statusTag,
    })),
    activeProjects: activeProjects.map((p) => ({
      _id: p._id,
      title: p.title,
      healthStatus: p.healthStatus,
      progress: p.progress,
      dueDate: p.dueDate,
    })),
  };
};

module.exports = { getStudentPerformanceDashboard };
