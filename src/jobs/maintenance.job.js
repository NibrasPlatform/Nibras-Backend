const cron = require("node-cron");
const logger = require("../core/utils/logger");
const Token = require("../modules/auth/models/token.model");

class MaintenanceJob {
  constructor() {
    this.task = null;
    this.schedule = process.env.MAINTENANCE_CRON || "0 3 * * *";
  }

  start() {
    logger.info(`Starting maintenance job with schedule: ${this.schedule}`);
    this.task = cron.schedule(this.schedule, async () => {
      try {
        const result = await Token.deleteMany({ expires: { $lte: new Date() } });
        logger.info(`Maintenance cleanup removed ${result.deletedCount || 0} expired auth tokens`);
      } catch (error) {
        logger.error("Maintenance cleanup failed", error.message);
      }
    });
  }

  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Maintenance job stopped");
    }
  }
}

module.exports = new MaintenanceJob();
