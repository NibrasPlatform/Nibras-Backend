const mongoose = require("mongoose");
const status = require("../../../core/constants/httpStatus");
const AppError = require("../../../core/utils/errorHandler");
const Contest = require("../../contests/models/contest.model");
const Question = require("../../community/models/question.model");
const Notification = require("../models/notification.model");
const schedulerService = require("./scheduler.service");
const { getIo } = require("../../../realtime/socket");

const normalizePagination = (page, limit) => {
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (pageNum - 1) * limitNum;
  return { page: pageNum, limit: limitNum, skip };
};

const emitRealtimeNotification = (recipientId, notification) => {
  try {
    const io = getIo();
    io.to(String(recipientId)).emit("notification:new", notification);
  } catch (error) {
    // Non-blocking by design: notification should still be persisted.
  }
};

const createNotification = async ({
  recipientId,
  actorId,
  type,
  title,
  message,
  relatedId,
  scheduledFor = null,
}) => {
  if (
    actorId &&
    recipientId &&
    String(actorId) === String(recipientId)
  ) {
    return null;
  }

  const notification = await Notification.create({
    recipient: recipientId,
    type,
    title,
    message,
    relatedId,
    scheduledFor,
    isSent: false,
  });

  if (!scheduledFor) {
    emitRealtimeNotification(recipientId, notification);
    notification.isSent = true;
    await notification.save();
  }

  return notification;
};

const getNotificationsForRecipient = async (recipientId, { page = 1, limit = 20 } = {}) => {
  const { page: pageNum, limit: limitNum, skip } = normalizePagination(page, limit);

  const [notifications, total] = await Promise.all([
    Notification.find({ recipient: recipientId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Notification.countDocuments({ recipient: recipientId }),
  ]);

  return {
    notifications,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

const getUnreadCount = async (recipientId) => {
  const count = await Notification.countDocuments({
    recipient: recipientId,
    isRead: false,
  });
  return { count };
};

const markAsRead = async (notificationId, recipientId) => {
  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipient: recipientId,
    },
    {
      $set: { isRead: true },
    },
    {
      returnDocument: "after",
    }
  );

  if (!notification) {
    throw AppError.create("Notification not found", 404, status.Fail);
  }

  return notification;
};

const markAllAsRead = async (recipientId) => {
  const result = await Notification.updateMany(
    { recipient: recipientId, isRead: false },
    { $set: { isRead: true } }
  );

  return { updatedCount: result.modifiedCount || 0 };
};

const scheduleContestReminder = async ({ contestId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(contestId)) {
    throw AppError.create("Invalid contest ID", 400, status.Fail);
  }

  const contest = await Contest.findById(contestId).select("title startTime status");
  if (!contest) {
    throw AppError.create("Contest not found", 404, status.Fail);
  }

  if (contest.status !== "upcoming" || new Date(contest.startTime) <= new Date()) {
    throw AppError.create("Can only set reminders for upcoming contests", 400, status.Fail);
  }

  const existingReminder = await Notification.findOne({
    recipient: userId,
    type: "contest_reminder",
    relatedId: contestId,
  });

  if (existingReminder) {
    throw AppError.create("Reminder already set for this contest", 409, status.Fail);
  }

  const scheduledFor = schedulerService.getContestReminderSchedule(contest.startTime);
  if (scheduledFor <= new Date()) {
    throw AppError.create("Contest starts in less than 15 minutes", 400, status.Fail);
  }

  return createNotification({
    recipientId: userId,
    type: "contest_reminder",
    title: "Contest reminder",
    message: `${contest.title} starts in 15 minutes.`,
    relatedId: contestId,
    scheduledFor,
  });
};

const notifyQuestionAnswered = async ({ questionId, answerId, actorId }) => {
  const question = await Question.findById(questionId).select("author title");
  if (!question?.author) {
    return null;
  }

  return createNotification({
    recipientId: question.author,
    actorId,
    type: "question_answered",
    title: "New answer on your question",
    message: `Someone answered your question: "${question.title}".`,
    relatedId: answerId,
  });
};

const notifyVote = async ({ targetType, targetId, recipientId, actorId }) => {
  const typeMap = {
    question: "question_vote",
    answer: "answer_vote",
    post: "comment_vote",
  };

  const notificationType = typeMap[targetType];
  if (!notificationType) {
    return null;
  }

  const titleMap = {
    question_vote: "Your question got an upvote",
    answer_vote: "Your answer got an upvote",
    comment_vote: "Your comment got an upvote",
  };

  return createNotification({
    recipientId,
    actorId,
    type: notificationType,
    title: titleMap[notificationType],
    message: "Your content received a new upvote.",
    relatedId: targetId,
  });
};

module.exports = {
  createNotification,
  getNotificationsForRecipient,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  scheduleContestReminder,
  notifyQuestionAnswered,
  notifyVote,
};
