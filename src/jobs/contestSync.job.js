const cron = require("node-cron");
const contestSyncService = require("../modules/contests/services/contestSync.service");
const logger = require("../core/utils/logger");

class ContestSyncJob {
  constructor() {
    this.task = null;
    this.schedule = process.env.CONTEST_SYNC_CRON || "0 */6 * * *";
    this.isRunning = false;
    this.currentTimeout = null;
  }

  start() {
    if (cron.validate(this.schedule)) {
      logger.info(`Starting contest sync job with schedule: ${this.schedule}`);
      
      this.task = cron.schedule(this.schedule, async () => {
        if (this.isRunning) {
          logger.warn("Contest sync already running, skipping this execution");
          return;
        }
        
        this.isRunning = true;
        try {
          logger.info("Running scheduled contest sync...");
          const results = await contestSyncService.syncAllContests();
          logger.info(
            `Scheduled sync completed: ${results.new} new, ${results.updated} updated, ${results.failed.length} failed`
          );
        } catch (error) {
          logger.error(`Scheduled contest sync failed: ${error.message}`);
        } finally {
          this.isRunning = false;
        }
      }, {
        scheduled: true,
        timezone: process.env.JOB_TIMEZONE || "Africa/Cairo"
      });

      logger.info("Contest sync job started successfully");
    } else {
      logger.error(`Invalid cron schedule: ${this.schedule}`);
    }
  }

  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Contest sync job stopped");
    }
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
    }
  }

  async runNow() {
    if (this.isRunning) {
      throw new Error("Contest sync already running");
    }
    
    this.isRunning = true;
    try {
      logger.info("Running manual contest sync...");
      const results = await contestSyncService.syncAllContests();
      logger.info(
        `Manual sync completed: ${results.new} new, ${results.updated} updated`
      );
      return results;
    } catch (error) {
      logger.error(`Manual contest sync failed: ${error.message}`);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new ContestSyncJob();
