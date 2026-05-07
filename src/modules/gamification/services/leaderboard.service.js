const mongoose = require("mongoose");
const Course = require("../../courses/models/course.model");
const ActivityEvent = require("../models/activityEvent.model");
const LeaderboardEntry = require("../models/leaderboardEntry.model");
const {
  DEFAULT_TIME_ZONE,
  formatWindowLabel,
  getPreviousWindowForPeriod,
  getWindowForPeriod,
  toDayKey,
} = require("../utils/window.util");

const BREAKDOWN_FIELDS = [
  "problem_solved",
  "contest_joined",
  "contest_top_25",
  "contest_top_10",
  "contest_rating_gain",
  "question_created",
  "answer_created",
  "accepted_answer",
  "question_upvote_received",
  "answer_upvote_received",
  "thread_created",
  "badge_awarded",
];

const COURSE_ALLOWED_EVENT_TYPES = new Set([
  "question_created",
  "answer_created",
  "accepted_answer",
  "question_upvote_received",
  "answer_upvote_received",
  "thread_created",
]);

const LEADERBOARD_SCORING_LEGEND = Object.freeze([
  {
    eventType: "problem_solved",
    label: "Problem solved",
    points: "10 / 20 / 35 / 50",
    note: "Difficulty-based points for beginner, newbie, intermediate, and advanced problems.",
  },
  {
    eventType: "contest_joined",
    label: "Contest joined",
    points: 15,
    note: "Awarded once per contest join.",
  },
  {
    eventType: "contest_top_25",
    label: "Contest top 25%",
    points: 25,
    note: "Added on top of contest join points.",
  },
  {
    eventType: "contest_top_10",
    label: "Contest top 10%",
    points: 50,
    note: "Added on top of contest join points.",
  },
  {
    eventType: "contest_rating_gain",
    label: "Contest rating gain",
    points: "1 point per +10 rating, capped at 30",
    note: "Only positive rating changes count.",
  },
  {
    eventType: "question_created",
    label: "Question created",
    points: 5,
    note: "Counts in global and course boards when a course is attached.",
  },
  {
    eventType: "answer_created",
    label: "Answer created",
    points: 15,
    note: "Counts in global and course boards when a course is attached.",
  },
  {
    eventType: "accepted_answer",
    label: "Accepted answer",
    points: 25,
    note: "Counts in global and course boards when a course is attached.",
  },
  {
    eventType: "question_upvote_received",
    label: "Question upvotes received",
    points: 2,
    note: "Daily cap of 20 points on question upvotes.",
  },
  {
    eventType: "answer_upvote_received",
    label: "Answer upvotes received",
    points: 3,
    note: "Daily cap of 30 points on answer upvotes.",
  },
  {
    eventType: "thread_created",
    label: "Thread created",
    points: 5,
    note: "Counts in global and course boards when a course is attached.",
  },
  {
    eventType: "badge_awarded",
    label: "Badge awarded",
    points: 15,
    note: "Counts in global boards only.",
  },
]);

class LeaderboardService {
  buildScopeMatch(scopeType, scopeId) {
    if (scopeType === "course") {
      return {
        "scope.courseId": new mongoose.Types.ObjectId(String(scopeId)),
        eventType: { $in: [...COURSE_ALLOWED_EVENT_TYPES] },
      };
    }

    return {};
  }

  async rebuildCurrentLeaderboards(referenceDate = new Date()) {
    await this.rebuildLeaderboardForWindow("weekly", "global", null, referenceDate);
    await this.rebuildLeaderboardForWindow("monthly", "global", null, referenceDate);
    await this.rebuildLeaderboardForWindow("all-time", "global", null, referenceDate);

    const weeklyWindow = getWindowForPeriod("weekly", referenceDate, DEFAULT_TIME_ZONE);
    const monthlyWindow = getWindowForPeriod("monthly", referenceDate, DEFAULT_TIME_ZONE);

    const [weeklyCourseIds, monthlyCourseIds, allTimeCourseIds] = await Promise.all([
      ActivityEvent.distinct("scope.courseId", {
        occurredAt: { $gte: weeklyWindow.windowStart, $lt: weeklyWindow.windowEnd },
        "scope.courseId": { $ne: null },
        eventType: { $in: [...COURSE_ALLOWED_EVENT_TYPES] },
      }),
      ActivityEvent.distinct("scope.courseId", {
        occurredAt: { $gte: monthlyWindow.windowStart, $lt: monthlyWindow.windowEnd },
        "scope.courseId": { $ne: null },
        eventType: { $in: [...COURSE_ALLOWED_EVENT_TYPES] },
      }),
      ActivityEvent.distinct("scope.courseId", {
        "scope.courseId": { $ne: null },
        eventType: { $in: [...COURSE_ALLOWED_EVENT_TYPES] },
      }),
    ]);

    for (const courseId of weeklyCourseIds.filter(Boolean)) {
      await this.rebuildLeaderboardForWindow("weekly", "course", courseId, referenceDate);
    }
    for (const courseId of monthlyCourseIds.filter(Boolean)) {
      await this.rebuildLeaderboardForWindow("monthly", "course", courseId, referenceDate);
    }
    for (const courseId of allTimeCourseIds.filter(Boolean)) {
      await this.rebuildLeaderboardForWindow("all-time", "course", courseId, referenceDate);
    }
  }

  async rebuildLeaderboardForWindow(period, scopeType, scopeId, referenceDate = new Date()) {
    const { windowStart, windowEnd } = getWindowForPeriod(period, referenceDate, DEFAULT_TIME_ZONE);
    const previousWindow = getPreviousWindowForPeriod(period, referenceDate, DEFAULT_TIME_ZONE);
    const match = {
      occurredAt: { $gte: windowStart, $lt: windowEnd },
      ...this.buildScopeMatch(scopeType, scopeId),
    };

    const events = await ActivityEvent.find(match)
      .sort({ occurredAt: 1, userId: 1 })
      .lean();

    await LeaderboardEntry.deleteMany({
      period,
      windowStart,
      scopeType,
      scopeId: scopeId || null,
    });

    if (events.length === 0) {
      return { period, scopeType, scopeId: scopeId || null, windowStart, windowEnd, entries: 0 };
    }

    const previousEntries = await LeaderboardEntry.find({
      period,
      windowStart: previousWindow.windowStart,
      scopeType,
      scopeId: scopeId || null,
    })
      .select("userId score")
      .lean();
    const previousScoreByUserId = new Map(previousEntries.map((entry) => [String(entry.userId), entry.score]));

    const usersMap = new Map();
    for (const event of events) {
      const userKey = String(event.userId);
      if (!usersMap.has(userKey)) {
        usersMap.set(userKey, {
          userId: event.userId,
          score: 0,
          firstActivityAt: event.occurredAt,
          activeDays: new Set(),
          breakdown: BREAKDOWN_FIELDS.reduce((accumulator, field) => {
            accumulator[field] = 0;
            return accumulator;
          }, {}),
          voteCaps: {},
        });
      }

      const entry = usersMap.get(userKey);
      const dayKey = toDayKey(event.occurredAt, DEFAULT_TIME_ZONE);
      entry.activeDays.add(dayKey);
      if (event.occurredAt < entry.firstActivityAt) {
        entry.firstActivityAt = event.occurredAt;
      }

      let pointsToAdd = Number(event.points || 0);
      if (event.eventType === "question_upvote_received") {
        const previous = entry.voteCaps[`question:${dayKey}`] || 0;
        const allowed = Math.max(20 - previous, 0);
        pointsToAdd = Math.min(pointsToAdd, allowed);
        entry.voteCaps[`question:${dayKey}`] = previous + pointsToAdd;
      } else if (event.eventType === "answer_upvote_received") {
        const previous = entry.voteCaps[`answer:${dayKey}`] || 0;
        const allowed = Math.max(30 - previous, 0);
        pointsToAdd = Math.min(pointsToAdd, allowed);
        entry.voteCaps[`answer:${dayKey}`] = previous + pointsToAdd;
      }

      entry.score += pointsToAdd;
      if (Object.prototype.hasOwnProperty.call(entry.breakdown, event.eventType)) {
        entry.breakdown[event.eventType] += pointsToAdd;
      }
    }

    const rankedEntries = [...usersMap.values()]
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.activeDays.size !== left.activeDays.size) return right.activeDays.size - left.activeDays.size;
        const firstActivityDelta = new Date(left.firstActivityAt).getTime() - new Date(right.firstActivityAt).getTime();
        if (firstActivityDelta !== 0) return firstActivityDelta;
        return String(left.userId).localeCompare(String(right.userId));
      })
      .map((entry, index) => ({
        period,
        windowStart,
        windowEnd,
        scopeType,
        scopeId: scopeId || null,
        userId: entry.userId,
        score: entry.score,
        rank: index + 1,
        scoreChange: entry.score - (previousScoreByUserId.get(String(entry.userId)) || 0),
        activeDays: entry.activeDays.size,
        breakdown: entry.breakdown,
        generatedAt: new Date(),
      }));

    if (rankedEntries.length > 0) {
      await LeaderboardEntry.insertMany(rankedEntries, { ordered: false });
    }

    return {
      period,
      scopeType,
      scopeId: scopeId || null,
      windowStart,
      windowEnd,
      entries: rankedEntries.length,
    };
  }

  async listLeaderboard({ period, scope, courseId, page = 1, limit = 20, userId }) {
    const { windowStart, windowEnd } = getWindowForPeriod(period, new Date(), DEFAULT_TIME_ZONE);
    const query = {
      period,
      windowStart,
      scopeType: scope,
      scopeId: scope === "course" ? courseId : null,
    };

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    let total = await LeaderboardEntry.countDocuments(query);
    if (total === 0 && period !== "all-time") {
      await this.rebuildLeaderboardForWindow(period, scope, courseId, new Date());
      total = await LeaderboardEntry.countDocuments(query);
    }

    const [entries, currentUser, topEntry] = await Promise.all([
      LeaderboardEntry.find(query)
        .sort({ rank: 1 })
        .skip(skip)
        .limit(limitNumber)
        .populate({
          path: "userId",
          select: "name role",
          populate: { path: "role", select: "name" },
        })
        .lean(),
      userId
        ? LeaderboardEntry.findOne({ ...query, userId })
            .select("rank score scoreChange activeDays breakdown generatedAt")
            .lean()
        : null,
      LeaderboardEntry.findOne(query)
        .sort({ rank: 1 })
        .select("score generatedAt")
        .lean(),
    ]);

    const percentile = currentUser?.rank && total > 0
      ? Math.round(((total - currentUser.rank + 1) / total) * 100)
      : null;
    const currentUserPayload = {
      rank: currentUser?.rank || null,
      score: currentUser?.score || 0,
      scoreChange: currentUser?.scoreChange || 0,
      activeDays: currentUser?.activeDays || 0,
      percentile,
      breakdown: currentUser?.breakdown || {},
    };

    return {
      period,
      scope: {
        type: scope,
        id: scope === "course" ? String(courseId) : null,
      },
      windowStart,
      windowEnd: period === "all-time" ? null : windowEnd,
      window: {
        start: windowStart,
        end: period === "all-time" ? null : windowEnd,
        label: formatWindowLabel(period, windowStart, windowEnd, DEFAULT_TIME_ZONE),
        resetsAt: period === "all-time" ? null : windowEnd,
        timeZone: DEFAULT_TIME_ZONE,
      },
      generatedAt: topEntry?.generatedAt || currentUser?.generatedAt || null,
      summary: {
        participantCount: total,
        topScore: topEntry?.score || 0,
      },
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber) || 1,
      },
      currentUser: currentUserPayload,
      entries: entries.map((entry) => ({
        rank: entry.rank,
        user: {
          id: String(entry.userId?._id || entry.userId),
          name: entry.userId?.name || "Unknown User",
          role: entry.userId?.role?.name || "Student",
        },
        score: entry.score,
        scoreChange: entry.scoreChange,
        activeDays: entry.activeDays,
        breakdown: entry.breakdown || {},
      })),
    };
  }

  async getMyRank({ period, scope, courseId, userId }) {
    const { windowStart, windowEnd } = getWindowForPeriod(period, new Date(), DEFAULT_TIME_ZONE);
    let entry = await LeaderboardEntry.findOne({
      period,
      windowStart,
      scopeType: scope,
      scopeId: scope === "course" ? courseId : null,
      userId,
    })
      .select("rank score scoreChange activeDays breakdown")
      .lean();

    if (!entry && period !== "all-time") {
      await this.rebuildLeaderboardForWindow(period, scope, courseId, new Date());
      entry = await LeaderboardEntry.findOne({
        period,
        windowStart,
        scopeType: scope,
        scopeId: scope === "course" ? courseId : null,
        userId,
      })
        .select("rank score scoreChange activeDays breakdown")
        .lean();
    }

    return {
      period,
      scope: {
        type: scope,
        id: scope === "course" ? String(courseId) : null,
      },
      windowStart,
      windowEnd,
      rank: entry?.rank || null,
      score: entry?.score || 0,
      scoreChange: entry?.scoreChange || 0,
      activeDays: entry?.activeDays || 0,
      breakdown: entry?.breakdown || {},
    };
  }

  async getConfig() {
    const courses = await Course.find()
      .sort({ title: 1 })
      .select("title")
      .lean();

    return {
      timeZone: DEFAULT_TIME_ZONE,
      defaults: {
        period: "weekly",
        scope: "global",
      },
      periods: ["weekly", "monthly", "all-time"],
      scopes: ["global", "course"],
      scoringLegend: LEADERBOARD_SCORING_LEGEND,
      courseScopeNote: "Course leaderboards are based on course community activity only.",
      courses: courses.map((course) => ({
        id: String(course._id),
        title: course.title,
      })),
    };
  }
}

module.exports = new LeaderboardService();
