const cron = require("node-cron");
const logger = require("../core/utils/logger");
const schedulerService = require("../modules/notifications/services/scheduler.service");
const { getIo } = require("../realtime/socket");

class NotificationReminderJob {
  constructor() {
    this.task = null;
    this.schedule = "* * * * *";
  }

  start() {
    if (!cron.validate(this.schedule)) {
      logger.error(`Invalid cron schedule: ${this.schedule}`);
      return;
    }

    logger.info(`Starting notification reminder job with schedule: ${this.schedule}`);

    this.task = cron.schedule(
      this.schedule,
      async () => {
        try {
          const dueNotifications = await schedulerService.getDueScheduledNotifications(new Date());
          let io = null;

          try {
            io = getIo();
          } catch (error) {
            logger.warn("Socket.io is not initialized; scheduled notifications will be marked as sent");
          }

          for (const notification of dueNotifications) {
            if (io) {
              io.to(String(notification.recipient)).emit("notification:new", notification);
            }
            await schedulerService.markAsSent(notification._id);
          }

          const cleanupResult = await schedulerService.cleanupOldReadNotifications(30);

          if (dueNotifications.length > 0 || (cleanupResult.deletedCount || 0) > 0) {
            logger.info(
              `Notification reminder job: sent ${dueNotifications.length}, cleaned ${cleanupResult.deletedCount || 0}`
            );
          }
        } catch (error) {
          logger.error("Notification reminder job failed", { message: error.message });
        }
      },
      {
        scheduled: true,
        timezone: process.env.JOB_TIMEZONE || "Africa/Cairo",
      }
    );
  }

  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Notification reminder job stopped");
    }
  }
}

module.exports = new NotificationReminderJob();
