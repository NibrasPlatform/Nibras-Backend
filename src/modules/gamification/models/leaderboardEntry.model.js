const mongoose = require("mongoose");

const breakdownFields = {
  problem_solved: { type: Number, default: 0 },
  contest_joined: { type: Number, default: 0 },
  contest_top_25: { type: Number, default: 0 },
  contest_top_10: { type: Number, default: 0 },
  contest_rating_gain: { type: Number, default: 0 },
  question_created: { type: Number, default: 0 },
  answer_created: { type: Number, default: 0 },
  accepted_answer: { type: Number, default: 0 },
  question_upvote_received: { type: Number, default: 0 },
  answer_upvote_received: { type: Number, default: 0 },
  thread_created: { type: Number, default: 0 },
  badge_awarded: { type: Number, default: 0 },
  lesson_completed: { type: Number, default: 0 },
  section_completed: { type: Number, default: 0 },
  course_completed: { type: Number, default: 0 },
  assignment_submitted: { type: Number, default: 0 },
  assignment_approved: { type: Number, default: 0 },
  high_grade: { type: Number, default: 0 },
  daily_learning_activity: { type: Number, default: 0 },
  learning_streak: { type: Number, default: 0 },
  course_progress_bonus: { type: Number, default: 0 },
};

const leaderboardEntrySchema = new mongoose.Schema(
  {
    period: {
      type: String,
      enum: ["weekly", "monthly", "all-time"],
      required: true,
    },
    windowStart: {
      type: Date,
      required: true,
    },
    windowEnd: {
      type: Date,
      required: true,
    },
    scopeType: {
      type: String,
      enum: ["global", "course"],
      required: true,
    },
    scopeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    score: {
      type: Number,
      required: true,
      default: 0,
    },
    rank: {
      type: Number,
      required: true,
      default: 0,
    },
    scoreChange: {
      type: Number,
      required: true,
      default: 0,
    },
    activeDays: {
      type: Number,
      required: true,
      default: 0,
    },
    breakdown: {
      type: new mongoose.Schema(breakdownFields, { _id: false }),
      default: () => ({}),
    },
    reputation: {
      total: { type: Number, default: 0 },
      breakdown: {
        type: new mongoose.Schema(
          {
            problem: { type: Number, default: 0 },
            community: { type: Number, default: 0 },
            contest: { type: Number, default: 0 },
            course: { type: Number, default: 0 },
          },
          { _id: false }
        ),
        default: () => ({}),
      },
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

leaderboardEntrySchema.index(
  { period: 1, windowStart: 1, scopeType: 1, scopeId: 1, userId: 1 },
  { unique: true },
);
leaderboardEntrySchema.index({ period: 1, windowStart: 1, scopeType: 1, scopeId: 1, rank: 1 });
leaderboardEntrySchema.index({ userId: 1, period: 1, scopeType: 1, scopeId: 1, windowStart: -1 });

module.exports = mongoose.models.LeaderboardEntry || mongoose.model("LeaderboardEntry", leaderboardEntrySchema);
