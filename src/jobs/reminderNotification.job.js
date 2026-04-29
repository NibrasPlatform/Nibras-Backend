const cron = require("node-cron");
const UserContestReminder = require("../modules/contests/models/userContestReminder.model");
const Contest = require("../modules/contests/models/contest.model");
const emailService = require("../modules/contests/services/email.service");
const logger = require("../core/utils/logger");

/**
 * Scheduled job to send contest reminder notifications
 * Runs every 5 minutes to check for contests starting soon
 */
class ReminderNotificationJob {
  constructor() {
    this.task = null;
    // Default: Every 5 minutes (*/5 * * * *)
    this.schedule = process.env.REMINDER_CHECK_CRON || "*/5 * * * *";
    // How many minutes before contest start to send reminder (default: 15)
    this.reminderMinutes =
      parseInt(process.env.REMINDER_TIME_BEFORE) || 15;
  }

  /**
   * Start the reminder notification job
   */
  start() {
    logger.info(
      `Starting reminder notification job with schedule: ${this.schedule}`
    );
    logger.info(
      `Reminders will be sent ${this.reminderMinutes} minutes before contest start`
    );

    this.task = cron.schedule(this.schedule, async () => {
      try {
        await this.sendReminders();
      } catch (error) {
        logger.error(`Reminder notification job failed: ${error.message}`);
      }
    });

    logger.info("Reminder notification job started successfully");
  }

  /**
   * Stop the reminder notification job
   */
  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Reminder notification job stopped");
    }
  }

  /**
   * Send reminder emails for contests starting soon
   */
  async sendReminders() {
    try {
      const now = new Date();
      const reminderTime = new Date(
        now.getTime() + this.reminderMinutes * 60 * 1000
      );

      // Find contests starting within the reminder window
      // Give a 10-minute window to account for job intervals
      const intervalMinutes = process.env.REMINDER_CHECK_INTERVAL ? parseInt(process.env.REMINDER_CHECK_INTERVAL) : 5; // Half of the job interval
      const windowStart = new Date(
        now.getTime() + (this.reminderMinutes - intervalMinutes) * 60 * 1000
      );
      const windowEnd = new Date(
        now.getTime() + (this.reminderMinutes + intervalMinutes) * 60 * 1000
      );

      const upcomingContests = await Contest.find({
        status: "upcoming",
        startTime: { $gte: windowStart, $lte: windowEnd },
      });

      if (upcomingContests.length === 0) {
        return;
      }

      logger.info(
        `Found ${upcomingContests.length} contests starting soon, checking for reminders...`
      );

      let remindersSent = 0;

      for (const contest of upcomingContests) {
        const reminders = await UserContestReminder.find({
          contestId: contest._id,
          reminderSent: false,
        }).populate("userId");

        for (const reminder of reminders) {
          try {
            if (!reminder.userId) {
              logger.warn(
                `User not found for reminder ${reminder._id}, skipping...`
              );
              continue;
            }

            // Send email
            const result = await emailService.sendContestReminder(
              reminder.userId,
              contest
            );

            if (result.success) {
              // Mark reminder as sent
              reminder.reminderSent = true;
              await reminder.save();
              remindersSent++;
              logger.info(
                `Reminder sent to ${reminder.userId.email} for contest: ${contest.title}`
              );
            } else {
              logger.error(
                `Failed to send reminder to ${reminder.userId.email}: ${result.error}`
              );
            }
          } catch (error) {
            logger.error(
              `Error processing reminder ${reminder._id}: ${error.message}`
            );
          }
        }
      }

      if (remindersSent > 0) {
        logger.info(`Reminder notification batch completed: ${remindersSent} emails sent`);
      }
    } catch (error) {
      logger.error(`Error in sendReminders: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run reminder check immediately (manual trigger)
   */
  async runNow() {
    try {
      logger.info("Running manual reminder check...");
      await this.sendReminders();
      logger.info("Manual reminder check completed");
    } catch (error) {
      logger.error(`Manual reminder check failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ReminderNotificationJob();
