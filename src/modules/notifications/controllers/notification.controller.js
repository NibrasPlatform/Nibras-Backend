const mongoose = require("mongoose");
const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const notificationService = require("../services/notification.service");

const getNotifications = catchAsync(async (req, res) => {
  const { notifications, pagination } = await notificationService.getNotificationsForRecipient(
    req.user._id,
    {
      page: req.query.page,
      limit: req.query.limit,
    }
  );

  res.status(200).json({
    success: true,
    data: {
      notifications,
      pagination,
    },
  });
});

const getUnreadCount = catchAsync(async (req, res) => {
  const data = await notificationService.getUnreadCount(req.user._id);
  res.status(200).json({ success: true, data });
});

const markAsRead = catchAsync(async (req, res) => {
  const notificationId = String(req.params.id || "");
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    throw AppError.create("Invalid notification ID", 400, status.Fail);
  }

  const notification = await notificationService.markAsRead(notificationId, req.user._id);

  res.status(200).json({
    success: true,
    data: { notification },
  });
});

const markAllAsRead = catchAsync(async (req, res) => {
  const data = await notificationService.markAllAsRead(req.user._id);
  res.status(200).json({ success: true, data });
});

const scheduleContestReminder = catchAsync(async (req, res) => {
  const contestId = String(req.params.contestId || "");
  if (!mongoose.Types.ObjectId.isValid(contestId)) {
    throw AppError.create("Invalid contest ID", 400, status.Fail);
  }

  const notification = await notificationService.scheduleContestReminder({
    contestId,
    userId: req.user._id,
  });

  res.status(201).json({
    success: true,
    data: { notification },
  });
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  scheduleContestReminder,
};
