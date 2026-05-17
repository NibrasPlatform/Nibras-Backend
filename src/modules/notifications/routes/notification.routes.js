const express = require("express");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const notificationController = require("../controllers/notification.controller");

const router = express.Router();

router.get("/", authMiddleware.authenticate, notificationController.getNotifications);
router.get(
  "/unread-count",
  authMiddleware.authenticate,
  notificationController.getUnreadCount
);
router.patch(
  "/:id/read",
  authMiddleware.authenticate,
  notificationController.markAsRead
);
router.patch(
  "/read-all",
  authMiddleware.authenticate,
  notificationController.markAllAsRead
);

module.exports = router;
