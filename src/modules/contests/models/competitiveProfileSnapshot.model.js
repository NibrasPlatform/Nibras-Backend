const mongoose = require("mongoose");

const contestHistoryEntrySchema = new mongoose.Schema(
  {
    contestId: String,
    contestName: String,
    rank: Number,
    oldRating: Number,
    newRating: Number,
    ratingChange: Number,
    date: Date,
  },
  { _id: false },
);

const submissionsSummarySchema = new mongoose.Schema(
  {
    total: { type: Number, default: 0 },
    accepted: { type: Number, default: 0 },
    wrongAnswer: { type: Number, default: 0 },
    verdictCounts: { type: Object, default: {} },
  },
  { _id: false },
);

const platformSnapshotSchema = new mongoose.Schema(
  {
    profileUrl: { type: String, default: null },
    rating: { type: Number, default: null },
    maxRating: { type: Number, default: null },
    rate: { type: String, default: null },
    maxRate: { type: String, default: null },
    solvedCount: { type: Number, default: null },
    solvedBreakdown: {
      easy: { type: Number, default: null },
      medium: { type: Number, default: null },
      hard: { type: Number, default: null },
    },
    contestParticipationCount: { type: Number, default: 0 },
    contestHistory: { type: [contestHistoryEntrySchema], default: [] },
    submissionsSummary: { type: submissionsSummarySchema, default: () => ({}) },
    badges: { type: [String], default: [] },
    stars: { type: Number, default: null },
    domainScores: {
      type: [
        new mongoose.Schema(
          {
            domain: { type: String, default: null },
            score: { type: Number, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    lastFetchedAt: { type: Date, default: null },
    payloadHash: { type: String, default: null },
  },
  { _id: false },
);

const competitiveProfileSnapshotSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    codeforces: { type: platformSnapshotSchema, default: () => ({}) },
    leetcode: { type: platformSnapshotSchema, default: () => ({}) },
    hackerrank: { type: platformSnapshotSchema, default: () => ({}) },
    lastAggregatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CompetitiveProfileSnapshot", competitiveProfileSnapshotSchema);
