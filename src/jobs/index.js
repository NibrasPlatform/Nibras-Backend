const logger = require("../core/utils/logger");
const contestSyncJob = require("./contestSync.job");
const contestStatusUpdateJob = require("./contestStatusUpdate.job");
const reminderNotificationJob = require("./reminderNotification.job");
const competitiveProfileSyncJob = require("./competitiveProfileSync.job");
const verificationRevalidationJob = require("./verificationRevalidation.job");
const maintenanceJob = require("./maintenance.job");
const leaderboardRebuildJob = require("./leaderboardRebuild.job");
const mentorSuggestionCacheWarmJob = require("./mentorSuggestionCacheWarm.job");

const jobs = [
  contestSyncJob,
  contestStatusUpdateJob,
  reminderNotificationJob,
  competitiveProfileSyncJob,
  verificationRevalidationJob,
  maintenanceJob,
  leaderboardRebuildJob,
  mentorSuggestionCacheWarmJob,
];

const startAllJobs = () => {
  const enabled = process.env.ENABLE_JOBS !== "false";
  if (!enabled) {
    logger.info("Background jobs are disabled via ENABLE_JOBS=false");
    return;
  }

  jobs.forEach((job) => job.start());
  logger.info(`Jobs bootstrap initialized (${jobs.length} jobs started).`);
};

const stopAllJobs = () => {
  jobs.forEach((job) => job.stop());
  logger.info("Jobs shutdown completed.");
};

module.exports = {
  startAllJobs,
  stopAllJobs,
};
