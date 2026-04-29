const cron = require("node-cron");
const logger = require("../core/utils/logger");
const competitiveProfileService = require("../modules/contests/services/competitiveProfile.service");

class CompetitiveProfileSyncJob {
  constructor() {
    this.task = null;
    this.schedule = process.env.PROFILE_SYNC_CRON || "0 */6 * * *";
  }

  start() {
    logger.info(`Starting competitive profile sync job with schedule: ${this.schedule}`);
    this.task = cron.schedule(this.schedule, async () => {
      try {
        const result = await competitiveProfileService.refreshDueProfiles();
        logger.info("Competitive profile sync completed", result);
      } catch (error) {
        logger.error("Competitive profile sync failed", error.message);
      }
    });
  }

  stop() {
    if (this.task) {
      this.task.stop();
    }
  }
}

module.exports = new CompetitiveProfileSyncJob();
