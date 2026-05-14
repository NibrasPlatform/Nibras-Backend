const cron = require("node-cron");
const logger = require("../core/utils/logger");
const mentorshipService = require("../modules/mentorship/services/mentorship.service");

class MentorSuggestionCacheWarmJob {
  constructor() {
    this.task = null;
    this.schedule = process.env.MENTOR_SUGGESTIONS_WARM_CRON || "0 */6 * * *";
  }

  start() {
    logger.info(`Starting mentor suggestion cache warm job with schedule: ${this.schedule}`);
    this.task = cron.schedule(this.schedule, async () => {
      try {
        const result = await mentorshipService.warmSuggestionsCache();
        logger.info("Mentor suggestions cache warm completed", result);
      } catch (error) {
        logger.error("Mentor suggestions cache warm failed", error.message);
      }
    });
  }

  stop() {
    if (this.task) {
      this.task.stop();
    }
  }
}

module.exports = new MentorSuggestionCacheWarmJob();
