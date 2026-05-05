/**
 * Production-Grade Contest Status Update Job
 */
const cron = require("node-cron");
const LockService = require("../core/services/lock.service");
const contestSyncService = require("../modules/contests/services/contestSync.service");
const logger = require("../core/utils/logger");

class ContestStatusUpdateJob {
  constructor() {
    this.task = null;
    this.schedule = process.env.STATUS_UPDATE_CRON || "*/5 * * * *";
    this.lockName = "contest-status-update";
    this.lockTtl = 180;
    
    this.metrics = {
      executions: 0,
      started: 0,
      finished: 0,
      skipped: 0,
    };
  }

  start() {
    if (!cron.validate(this.schedule)) {
      logger.error(`Invalid cron schedule: ${this.schedule}`);
      return;
    }

    logger.info(`Starting contest status update job with schedule: ${this.schedule}`);

    this.task = cron.schedule(this.schedule, async () => {
      const startTime = Date.now();

      try {
        const lockAcquired = await LockService.acquire(
          this.lockName,
          this.lockTtl,
          { waitForLock: true, maxWaitMs: 10000 }
        );

        if (!lockAcquired) {
          logger.warn("Could not acquire lock for status update, skipping");
          this.metrics.skipped++;
          return;
        }

        const results = await contestSyncService.updateContestStatuses();
        
        this.metrics.executions++;
        this.metrics.started += results.started;
        this.metrics.finished += results.finished;

        const duration = Date.now() - startTime;
        
        if (results.started > 0 || results.finished > 0) {
          logger.info(
            `Contest status update completed in ${duration}ms: ` +
            `${results.started} started, ${results.finished} finished`
          );
        }

      } catch (error) {
        logger.error(`Contest status update failed: ${error.message}`);
      } finally {
        await LockService.release(this.lockName);
      }
    }, {
      scheduled: true,
      timezone: process.env.JOB_TIMEZONE || "Africa/Cairo",
    });

    logger.info("Contest status update job started successfully");
  }

  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Contest status update job stopped");
    }
  }

  async runNow() {
    const lockAcquired = await LockService.acquire(
      `${this.lockName}-manual`,
      30,
      { waitForLock: true, maxWaitMs: 5000 }
    );

    if (!lockAcquired) {
      throw new Error("Manual status update already running");
    }

    try {
      logger.info("Running manual contest status update...");
      const results = await contestSyncService.updateContestStatuses();
      logger.info(`Manual status update: ${results.started} started, ${results.finished} finished`);
      return results;
    } finally {
      await LockService.release(`${this.lockName}-manual`);
    }
  }

  getStats() {
    return {
      metrics: this.metrics,
    };
  }
}

module.exports = new ContestStatusUpdateJob();