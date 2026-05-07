const cron = require("node-cron");
const logger = require("../core/utils/logger");
const accountVerificationService = require("../modules/contests/services/accountVerification.service");

class VerificationRevalidationJob {
  constructor() {
    this.task = null;
    this.schedule = process.env.ACCOUNT_REVALIDATION_CRON || "0 2 * * *";
  }

  start() {
    logger.info(`Starting verification revalidation job with schedule: ${this.schedule}`);
    this.task = cron.schedule(this.schedule, async () => {
      try {
        const result = await accountVerificationService.expireDueVerifications();
        logger.info("Verification revalidation completed", result);
      } catch (error) {
        logger.error("Verification revalidation failed", error.message);
      }
    });
  }

  stop() {
    if (this.task) {
      this.task.stop();
    }
  }
}

module.exports = new VerificationRevalidationJob();
