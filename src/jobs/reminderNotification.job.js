/**
 * Production-Grade Reminder Notification Job
 * Features:
 * - Distributed locking
 * - Batched processing with concurrency
 * - Safe email sending with timeout
 * - Comprehensive metrics
 */
const cron = require("node-cron");
const LockService = require("../core/services/lock.service");
const UserContestReminder = require("../modules/contests/models/userContestReminder.model");
const Contest = require("../modules/contests/models/contest.model");
const emailService = require("../modules/contests/services/email.service");
const ConcurrencyLimiter = require("../core/utils/concurrencyLimiter");
const logger = require("../core/utils/logger");

class ReminderNotificationJob {
  constructor() {
    this.task = null;
    this.schedule = process.env.REMINDER_CHECK_CRON || "*/5 * * * *";
    this.lockName = "reminder-notification";
    this.lockTtl = 300;
    
    this.reminderMinutes = parseInt(process.env.REMINDER_TIME_BEFORE || "15", 10);
    this.emailConcurrency = parseInt(process.env.REMINDER_EMAIL_CONCURRENCY || "3", 10);
    
    this.limiter = new ConcurrencyLimiter({ 
      concurrency: this.emailConcurrency, 
      maxQueueSize: 500 
    });

    this.metrics = {
      executions: 0,
      emailsSent: 0,
      emailsFailed: 0,
      contestsChecked: 0,
      skipped: 0,
    };
  }

  start() {
    if (!cron.validate(this.schedule)) {
      logger.error(`Invalid cron schedule: ${this.schedule}`);
      return;
    }

    logger.info(`Starting reminder notification job with schedule: ${this.schedule}`);
    logger.info(`Reminder window: ${this.reminderMinutes} minutes, Email concurrency: ${this.emailConcurrency}`);

    this.task = cron.schedule(this.schedule, async () => {
      const startTime = Date.now();

      try {
        const lockAcquired = await LockService.acquire(
          this.lockName,
          this.lockTtl,
          { waitForLock: true, maxWaitMs: 10000 }
        );

        if (!lockAcquired) {
          logger.warn("Could not acquire lock for reminder job, skipping");
          this.metrics.skipped++;
          return;
        }

        const result = await this.sendReminders();
        
        this.metrics.executions++;
        const duration = Date.now() - startTime;

        logger.info(
          `Reminder job completed in ${duration}ms: ` +
          `${result.emailsSent} sent, ${result.emailsFailed} failed, ${result.contestsChecked} contests checked`
        );

        if (duration > 30000) {
          logger.warn(`Warning: Reminder job took ${duration}ms (>30s)`);
        }

      } catch (error) {
        logger.error(`Reminder job failed: ${error.message}`);
      } finally {
        await LockService.release(this.lockName);
      }
    }, {
      scheduled: true,
      timezone: process.env.JOB_TIMEZONE || "Africa/Cairo",
    });

    logger.info("Reminder notification job started successfully");
  }

  async sendReminders() {
    const now = new Date();
    const intervalMinutes = parseInt(process.env.REMINDER_CHECK_INTERVAL || "5", 10);
    
    const windowStart = new Date(
      now.getTime() + (this.reminderMinutes - intervalMinutes) * 60 * 1000
    );
    const windowEnd = new Date(
      now.getTime() + (this.reminderMinutes + intervalMinutes) * 60 * 1000
    );

    const upcomingContests = await Contest.find({
      status: "upcoming",
      startTime: { $gte: windowStart, $lte: windowEnd },
    }).lean();

    const result = {
      emailsSent: 0,
      emailsFailed: 0,
      contestsChecked: upcomingContests.length,
    };

    if (upcomingContests.length === 0) {
      return result;
    }

    logger.info(`Found ${upcomingContests.length} contests in reminder window`);

    const contestMap = new Map(upcomingContests.map(c => [c._id.toString(), c]));

    const reminderDocs = await UserContestReminder.find({
      contestId: { $in: upcomingContests.map(c => c._id) },
      reminderSent: false,
    }).lean();

    const groupedReminders = new Map();
    for (const reminder of reminderDocs) {
      const key = reminder.contestId.toString();
      if (!groupedReminders.has(key)) {
        groupedReminders.set(key, []);
      }
      groupedReminders.get(key).push(reminder);
    }

    const emailPromises = [];
    
    for (const [contestId, reminders] of groupedReminders) {
      const contest = contestMap.get(contestId);
      if (!contest) continue;

      for (const reminder of reminders) {
        const promise = this.limiter.execute(
          async () => {
            try {
              const emailResult = await this.sendReminderEmail(reminder.userId, contest);
              
              if (emailResult.success) {
                await UserContestReminder.updateOne(
                  { _id: reminder._id },
                  { $set: { reminderSent: true, sentAt: new Date() } }
                );
                return { success: true };
              } else {
                return { success: false, error: emailResult.error };
              }
            } catch (error) {
              return { success: false, error: error.message };
            }
          },
          { priority: 5, timeoutMs: 30000 }
        );
        
        emailPromises.push(
          promise
            .then(r => {
              if (r.success) result.emailsSent++;
              else result.emailsFailed++;
            })
            .catch(() => result.emailsFailed++)
        );
      }
    }

    await Promise.allSettled(emailPromises);

    return result;
  }

  async sendReminderEmail(userId, contest) {
    const user = await this.getUserById(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    return await emailService.sendContestReminder(user, contest);
  }

  async getUserById(userId) {
    const User = require("../modules/users/models/user.model");
    return await User.findById(userId).lean();
  }

  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Reminder notification job stopped");
    }
  }

  async runNow() {
    const lockAcquired = await LockService.acquire(
      `${this.lockName}-manual`,
      60,
      { waitForLock: true, maxWaitMs: 10000 }
    );

    if (!lockAcquired) {
      throw new Error("Manual reminder check already running");
    }

    try {
      logger.info("Running manual reminder check...");
      const result = await this.sendReminders();
      logger.info(`Manual reminder check completed: ${result.emailsSent} sent`);
      return result;
    } finally {
      await LockService.release(`${this.lockName}-manual`);
    }
  }

  getStats() {
    return {
      metrics: this.metrics,
      limiter: this.limiter.getStats(),
    };
  }
}

module.exports = new ReminderNotificationJob();