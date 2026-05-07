/**
 * {
  title,
  platform: "codeforces | leetcode | hackerrank",
  contestIdOnPlatform,
  url,
  startTime,
  duration,
  status, // upcoming | running | finished
    }
 */
const mongoose = require("mongoose");

const contestSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    platform: {
        type: String,
        required: true,
    },
    contestIdOnPlatform: {
        type: String,
        required: true,
    },
    url: {
        type: String,
        required: true,
    },
    startTime: {
        type: Date,
        required: true,
    },
    duration: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        required: true,
        enum: ["upcoming", "running", "finished"],
    },
    numberOfProblems: {
        type: Number,
        default: 0,
    },
    registeredCount: {
        type: Number,
        default: 0,
    },
    participantsCount: {
        type: Number,
        default: 0,
    },
    lastSyncedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model("Contest", contestSchema);
