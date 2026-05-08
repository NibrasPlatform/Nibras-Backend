const cron = require("node-cron");
const logger = require("../core/utils/logger");
const leaderboardService = require("../modules/gamification/services/leaderboard.service");

class LeaderboardRebuildJob {
  constructor() {
    this.task = null;
    this.schedule = process.env.LEADERBOARD_REBUILD_CRON || "10 * * * *";
  }

  start() {
    logger.info(`Starting leaderboard rebuild job with schedule: ${this.schedule}`);
    this.task = cron.schedule(this.schedule, async () => {
      try {
        const result = await leaderboardService.rebuildCurrentLeaderboards();
        logger.info("Leaderboard rebuild completed", result);
      } catch (error) {
        logger.error("Leaderboard rebuild failed", error.message);
      }
    });
  }

  stop() {
    if (this.task) {
      this.task.stop();
    }
  }
}

module.exports = new LeaderboardRebuildJob();
