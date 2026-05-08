const mongoose = require("mongoose");

const roleEnum = ["Student", "Instructor", "TA", "Admin", "Super Admin"];
const sourceEnum = ["problems", "contests", "community", "gamification", "manual"];
const eventTypeEnum = [
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

const activityEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    roleSnapshot: {
      type: String,
      enum: roleEnum,
      required: true,
    },
    source: {
      type: String,
      enum: sourceEnum,
      required: true,
    },
    eventType: {
      type: String,
      enum: eventTypeEnum,
      required: true,
      index: true,
    },
    points: {
      type: Number,
      required: true,
      default: 0,
    },
    occurredAt: {
      type: Date,
      required: true,
      index: true,
    },
    scope: {
      global: {
        type: Boolean,
        default: true,
      },
      courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
        default: null,
      },
    },
    refs: {
      problemId: { type: mongoose.Schema.Types.ObjectId, ref: "Problem", default: null },
      contestId: { type: mongoose.Schema.Types.ObjectId, ref: "Contest", default: null },
      questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", default: null },
      answerId: { type: mongoose.Schema.Types.ObjectId, ref: "Answer", default: null },
      threadId: { type: mongoose.Schema.Types.ObjectId, ref: "Thread", default: null },
      achievementId: { type: mongoose.Schema.Types.ObjectId, ref: "Achievement", default: null },
      voteId: { type: mongoose.Schema.Types.ObjectId, ref: "Vote", default: null },
    },
    metadata: {
      difficulty: {
        type: String,
        enum: ["beginner", "newbie", "intermediate", "advanced", null],
        default: null,
      },
      ratingChange: {
        type: Number,
        default: null,
      },
      percentileBucket: {
        type: String,
        enum: ["top_10", "top_25", null],
        default: null,
      },
    },
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

activityEventSchema.index({ userId: 1, occurredAt: -1 });
activityEventSchema.index({ "scope.courseId": 1, occurredAt: -1 });
activityEventSchema.index({ eventType: 1, occurredAt: -1 });

module.exports = mongoose.models.ActivityEvent || mongoose.model("ActivityEvent", activityEventSchema);
