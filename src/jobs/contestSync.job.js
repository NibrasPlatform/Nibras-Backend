const cron = require("node-cron");
const contestSyncService = require("../modules/contests/services/contestSync.service");
const logger = require("../core/utils/logger");

/**
 * Scheduled job to sync contests from all platforms
 * Runs every 6 hours by default
 */
class ContestSyncJob {
  constructor() {
    this.task = null;
    // Default: Every 6 hours (0 */6 * * *)
    this.schedule = process.env.CONTEST_SYNC_CRON || "0 */6 * * *";
  }

  /**
   * Start the sync job
   */
  start() {
    logger.info(`Starting contest sync job with schedule: ${this.schedule}`);

    this.task = cron.schedule(this.schedule, async () => {
      try {
        logger.info("Running scheduled contest sync...");
        const results = await contestSyncService.syncAllContests();
        logger.info(
          `Scheduled sync completed: ${results.new} new, ${results.updated} updated, ${results.failed.length} failed`
        );
      } catch (error) {
        logger.error(`Scheduled contest sync failed: ${error.message}`);
      }
    });

    logger.info("Contest sync job started successfully");
  }

  /**
   * Stop the sync job
   */
  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Contest sync job stopped");
    }
  }

  /**
   * Run sync immediately (manual trigger)
   */
  async runNow() {
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
    }
  }
}

module.exports = new ContestSyncJob();
