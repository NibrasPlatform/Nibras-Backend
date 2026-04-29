const cron = require("node-cron");
const contestSyncService = require("../modules/contests/services/contestSync.service");
const logger = require("../core/utils/logger");

/**
 * Scheduled job to update contest statuses
 * Runs every 5 minutes to keep statuses current
 */
class ContestStatusUpdateJob {
  constructor() {
    this.task = null;
    // Default: Every 5 minutes (*/5 * * * *)
    this.schedule = process.env.STATUS_UPDATE_CRON || "*/5 * * * *";
  }

  /**
   * Start the status update job
   */
  start() {
    logger.info(
      `Starting contest status update job with schedule: ${this.schedule}`
    );

    this.task = cron.schedule(this.schedule, async () => {
      try {
        const results = await contestSyncService.updateContestStatuses();
        if (results.started > 0 || results.finished > 0) {
          logger.info(
            `Contest statuses updated: ${results.started} started, ${results.finished} finished`
          );
        }
      } catch (error) {
        logger.error(`Contest status update failed: ${error.message}`);
      }
    });

    logger.info("Contest status update job started successfully");
  }

  /**
   * Stop the status update job
   */
  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Contest status update job stopped");
    }
  }

  /**
   * Run status update immediately (manual trigger)
   */
  async runNow() {
    try {
      logger.info("Running manual contest status update...");
      const results = await contestSyncService.updateContestStatuses();
      logger.info(
        `Status update completed: ${results.started} started, ${results.finished} finished`
      );
      return results;
    } catch (error) {
      logger.error(`Manual status update failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ContestStatusUpdateJob();
