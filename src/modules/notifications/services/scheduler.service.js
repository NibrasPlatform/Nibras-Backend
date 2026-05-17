const Notification = require("../models/notification.model");

const REMINDER_MINUTES_BEFORE_CONTEST = 15;

const getContestReminderSchedule = (contestStartTime) => {
  const startAt = new Date(contestStartTime);
  return new Date(startAt.getTime() - REMINDER_MINUTES_BEFORE_CONTEST * 60 * 1000);
};

const getDueScheduledNotifications = async (now = new Date()) => {
  return Notification.find({
    scheduledFor: { $lte: now },
    isSent: false,
  }).sort({ scheduledFor: 1 });
};

const markAsSent = async (notificationId) => {
  return Notification.findByIdAndUpdate(
    notificationId,
    { $set: { isSent: true } },
    { returnDocument: "after" }
  );
};

const cleanupOldReadNotifications = async (olderThanDays = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  return Notification.deleteMany({
    isRead: true,
    updatedAt: { $lt: cutoffDate },
  });
};

module.exports = {
  REMINDER_MINUTES_BEFORE_CONTEST,
  getContestReminderSchedule,
  getDueScheduledNotifications,
  markAsSent,
  cleanupOldReadNotifications,
};
