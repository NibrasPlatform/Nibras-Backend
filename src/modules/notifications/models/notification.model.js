const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "contest_reminder",
        "question_answered",
        "question_vote",
        "answer_vote",
        "comment_vote",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isSent: {
      type: Boolean,
      default: false,
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ scheduledFor: 1, isSent: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
